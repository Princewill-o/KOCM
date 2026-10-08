create function private.is_real_reporting_email(p_email text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_email ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$' and lower(p_email) !~ '\.(invalid|example|test)$' and lower(p_email) !~ '(@|\.)example\.(com|net|org)$',false)
$$;
revoke all on function private.is_real_reporting_email(text) from public,anon,authenticated;
-- Cluster reports gain an explicit reporting period. Existing RPC callers default
-- to the current Saturday-Friday UK week; past snapshots derive their period.
alter table public.cluster_reports add column week_ending date,add column season_id text references public.seasons(id),add column is_late boolean not null default false;
update public.cluster_reports r set week_ending=(r.created_at at time zone 'Europe/London')::date+((5-extract(isodow from r.created_at at time zone 'Europe/London')::int+7)%7);
update public.cluster_reports r set season_id=s.id,is_late=r.created_at>=((r.week_ending::timestamp+make_interval(hours=>s.deadline_hour)) at time zone s.time_zone) from public.seasons s where r.week_ending between s.start_date and s.end_date;
create index cluster_reports_reporting_week on public.cluster_reports(cluster_id,season_id,week_ending) where scope='cluster';
alter function public.submit_cluster_report(jsonb,uuid) rename to submit_cluster_report_unperioded;
revoke all on function public.submit_cluster_report_unperioded(jsonb,uuid) from public,anon,authenticated;
create function public.submit_cluster_report(p_answers jsonb,p_request_id uuid,p_week_ending date default null) returns public.cluster_reports language plpgsql security definer set search_path='' as $$
declare week date:=p_week_ending; s public.seasons; r public.cluster_reports; old public.cluster_reports; uk date:=(now() at time zone 'Europe/London')::date;
begin
 select * into s from public.seasons where is_current;
 if week is null then week:=uk+((5-extract(isodow from uk)::int+7)%7);end if;
 if s.id is null or week not between s.start_date and s.end_date or extract(isodow from week)<>5 or now()<((week-6)::timestamp at time zone s.time_zone) then raise exception 'Choose an open Friday in the current reporting season.' using errcode='22023';end if;
 if auth.uid() is null then raise exception 'Sign in.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('cluster-period-'||auth.uid()::text||p_request_id::text,0));
 select * into old from public.cluster_reports where submitted_by=auth.uid() and request_id=p_request_id;
 if old.id is not null and old.week_ending is distinct from week then raise exception 'Request belongs to a different reporting week.' using errcode='22023';end if;
 r:=public.submit_cluster_report_unperioded(p_answers,p_request_id);
 if old.id is null then
  update public.cluster_reports set week_ending=week,season_id=s.id,is_late=created_at>=((week::timestamp+make_interval(hours=>s.deadline_hour)) at time zone s.time_zone) where id=r.id returning * into r;
  if r.is_late then update public.notifications set title='Late cluster report submitted',message=r.submitter_name||' submitted a cluster report after Friday 10pm UK time.' where cluster_report_id=r.id;end if;
 end if;return r;
end $$;
revoke all on function public.submit_cluster_report(jsonb,uuid,date) from public,anon;grant execute on function public.submit_cluster_report(jsonb,uuid,date) to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('late_report','low_grade','cluster_report','lead_application','report_reminder','missing_report'));
alter table public.notifications add column reporting_week date,add column reporting_season_id text,add column reporting_scope text,add column reporting_scope_id uuid;
create unique index one_weekly_reporting_alert on public.notifications(recipient_id,kind,reporting_week,reporting_season_id,reporting_scope,reporting_scope_id) where kind in ('report_reminder','missing_report');
alter table private.account_email_deliveries drop constraint account_email_deliveries_kind_check;
alter table private.account_email_deliveries add constraint account_email_deliveries_kind_check check(kind in ('rejection','weekly_digest','report_reminder','missing_report'));
create unique index one_weekly_lead_email on private.account_email_deliveries(user_id,kind,(payload->>'scope'),(payload->>'scopeId'),(payload->>'weekEnding'),(payload->>'seasonId')) where kind in ('report_reminder','missing_report');
create function private.report_task_missing(p_scope text,p_scope_id uuid,p_week date,p_season text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_scope='campus' then exists(select 1 from public.campuses c join public.profiles p on p.campus_id=c.id and p.role='campus' and p.status='active' where c.id=p_scope_id and c.is_active) and not exists(select 1 from public.reports r where r.campus_id=p_scope_id and r.week_ending=p_week and r.season_id=p_season)
 when p_scope='cluster' then exists(select 1 from public.clusters where id=p_scope_id and is_active) and exists(select 1 from public.campuses c join public.profiles p on p.cluster_id=c.cluster_id and p.role='cluster' and p.status='active' where c.cluster_id=p_scope_id and c.is_active) and not exists(select 1 from public.cluster_reports r where r.cluster_id=p_scope_id and r.scope='cluster' and r.week_ending=p_week and r.season_id=p_season) else false end
$$;
revoke all on function private.report_task_missing(text,uuid,date,text) from public,anon,authenticated;
create function private.queue_weekly_report_alerts(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare uk timestamp:=p_now at time zone 'Europe/London'; s public.seasons; kind text; task record; recipient record; added integer:=0; rows integer;
begin
 if extract(isodow from uk)<>5 or extract(hour from uk) not in (20,23) then return 0;end if;
 select * into s from public.seasons where is_current and uk::date between start_date and end_date;if s.id is null then return 0;end if;
 kind:=case when extract(hour from uk)=20 then 'report_reminder' else 'missing_report' end;
 for task in
  select 'campus'::text scope,c.id scope_id,c.name::text scope_name,p.id lead_id from public.campuses c join public.profiles p on p.campus_id=c.id and p.role='campus' and p.status='active' where c.is_active
  union all
  select 'cluster',cl.id,cl.name,p.id from public.clusters cl join public.profiles p on p.cluster_id=cl.id and p.role='cluster' and p.status='active' where cl.is_active and exists(select 1 from public.campuses c where c.cluster_id=cl.id and c.is_active)
 loop
  if not private.report_task_missing(task.scope,task.scope_id,uk::date,s.id) then continue;end if;
  for recipient in select p.* from public.profiles p where p.id=task.lead_id or (kind='missing_report' and p.role='admin' and p.status='active') loop
   insert into public.notifications(recipient_id,kind,title,message,campus_id,reporting_week,reporting_season_id,reporting_scope,reporting_scope_id)
   values(recipient.id,kind,case when kind='report_reminder' then 'Weekly report due tonight' else 'Weekly report not submitted' end,task.scope_name||' has not submitted the '||task.scope||' report for Friday '||uk::date||'. Reports are due at 10pm UK time.',case when task.scope='campus' then task.scope_id else null end,uk::date,s.id,task.scope,task.scope_id) on conflict do nothing;
   get diagnostics rows=row_count;added:=added+rows;
   -- Leadership already receives the Friday digest; lead reminders are separate.
   if recipient.id=task.lead_id then
    insert into private.account_email_deliveries(user_id,recipient,full_name,reason,kind,payload)
    select recipient.id,recipient.email,recipient.full_name,'',kind,jsonb_build_object('scope',task.scope,'scopeId',task.scope_id,'scopeName',task.scope_name,'weekEnding',uk::date,'seasonId',s.id)
    from auth.users u where u.id=recipient.id and u.email_confirmed_at is not null and lower(u.email)=lower(recipient.email) and private.is_real_reporting_email(recipient.email)
    on conflict do nothing;
   end if;
  end loop;
 end loop;return added;
end $$;
revoke all on function private.queue_weekly_report_alerts(timestamptz) from public,anon,authenticated;
alter table public.notifications add column resolved_at timestamptz;
create function private.report_email_current(q private.account_email_deliveries) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=q.user_id and p.status='active' and p.email=q.recipient and lower(u.email)=lower(p.email) and u.email_confirmed_at is not null and private.is_real_reporting_email(p.email)
 and ((q.payload->>'scope'='campus' and p.role='campus' and p.campus_id=(q.payload->>'scopeId')::uuid) or (q.payload->>'scope'='cluster' and p.role='cluster' and p.cluster_id=(q.payload->>'scopeId')::uuid)))
 and exists(select 1 from public.seasons s where s.id=q.payload->>'seasonId' and s.is_current and (q.payload->>'weekEnding')::date between s.start_date and s.end_date)
 and (q.payload->>'weekEnding')::date=((now() at time zone 'Europe/London')::date+((5-extract(isodow from now() at time zone 'Europe/London')::int+7)%7))
 and private.report_task_missing(q.payload->>'scope',(q.payload->>'scopeId')::uuid,(q.payload->>'weekEnding')::date,q.payload->>'seasonId')
$$;
revoke all on function private.report_email_current(private.account_email_deliveries) from public,anon,authenticated;
create function private.reconcile_reporting_alerts() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.notifications n set resolved_at=now(),read_at=coalesce(n.read_at,now()),title='Resolved — '||n.title,message=n.message||' This reporting alert is no longer outstanding.'
 where n.kind in ('report_reminder','missing_report') and n.resolved_at is null and (not private.report_task_missing(n.reporting_scope,n.reporting_scope_id,n.reporting_week,n.reporting_season_id)
 or not exists(select 1 from public.profiles p where p.id=n.recipient_id and p.status='active' and (p.role='admin' or (n.reporting_scope='campus' and p.role='campus' and p.campus_id=n.reporting_scope_id) or (n.reporting_scope='cluster' and p.role='cluster' and p.cluster_id=n.reporting_scope_id))));
 update private.account_email_deliveries q set status='cancelled',last_error=null where q.kind in ('report_reminder','missing_report') and q.status in ('pending','failed') and not private.report_email_current(q);
end $$;
revoke all on function private.reconcile_reporting_alerts() from public,anon,authenticated;
create function private.reporting_alert_changed() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.reconcile_reporting_alerts();return new;end $$;
revoke all on function private.reporting_alert_changed() from public,anon,authenticated;
create trigger reporting_alert_report_change after insert or update on public.reports for each row execute function private.reporting_alert_changed();
create trigger reporting_alert_cluster_change after insert or update on public.cluster_reports for each row execute function private.reporting_alert_changed();
create trigger reporting_alert_campus_change after update of is_active,cluster_id on public.campuses for each row execute function private.reporting_alert_changed();
create trigger reporting_alert_cluster_lifecycle after update of is_active on public.clusters for each row execute function private.reporting_alert_changed();
create trigger reporting_alert_profile_change after update of status,role,campus_id,cluster_id,email on public.profiles for each row execute function private.reporting_alert_changed();
create or replace function public.claim_account_emails() returns setof private.account_email_deliveries language plpgsql security definer set search_path='' as $$
begin
 perform private.reconcile_reporting_alerts();
 update private.account_email_deliveries q set status='cancelled',last_error=null where q.kind in ('report_reminder','missing_report') and q.status='sending' and q.claimed_at<now()-interval '10 minutes' and not private.report_email_current(q);
 return query update private.account_email_deliveries d set status='sending',attempts=d.attempts+1,claimed_at=now(),last_error=null
 where d.id in(select q.id from private.account_email_deliveries q join public.profiles p on p.id=q.user_id
 where p.email=q.recipient and lower(q.recipient) not like '%.invalid' and q.attempts<5
 and ((q.kind='rejection' and p.status='rejected') or (q.kind='weekly_digest' and p.status='active' and p.role='admin' and private.is_real_reporting_email(p.email) and exists(select 1 from auth.users u where u.id=p.id and u.email_confirmed_at is not null and lower(u.email)=lower(p.email))) or (q.kind in ('report_reminder','missing_report') and private.report_email_current(q)))
 and (q.status='pending' or (q.status='failed' and q.claimed_at<now()-interval '1 minute') or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
 order by q.created_at limit 3 for update of q skip locked) returning d.*;
end $$;
create or replace function private.run_account_email_schedule() returns void language plpgsql security definer set search_path='' as $$
declare token text;
begin
 perform private.queue_weekly_report_alerts();
 perform private.reconcile_reporting_alerts();
 perform private.queue_weekly_admin_digest();
 if exists(select 1 from private.account_email_deliveries where attempts<5 and status in ('pending','failed','sending')) then
  select decrypted_secret into token from vault.decrypted_secrets where name='koc_account_email_worker';
  perform net.http_post(url:='https://yrqkafiqwllkphroztqk.supabase.co/functions/v1/account-email-delivery',headers:=jsonb_build_object('Content-Type','application/json','X-KOC-Worker-Token',token),body:='{}'::jsonb,timeout_milliseconds:=100000);
 end if;
end $$;

-- Existing leadership digest also includes missing cluster-level reports.
create or replace function private.queue_weekly_admin_digest(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare uk timestamp:=p_now at time zone 'Europe/London'; week_date date; season text; missing jsonb; late jsonb; queued integer;
begin
 if extract(isodow from uk)<>5 or extract(hour from uk)<>23 then return 0; end if;
 week_date:=uk::date;
 select id into season from public.seasons where is_current and week_date between start_date and end_date;
 if season is null then return 0; end if;
 select coalesce(jsonb_agg(c.name || ' — ' || coalesce(leads.names,'No active campus lead assigned') || coalesce(' (cluster: ' || cl.lead_name || ')','') order by c.name),'[]'::jsonb) into missing
 from public.campuses c left join public.clusters cl on cl.id=c.cluster_id
 left join lateral (select string_agg(p.full_name,', ' order by p.full_name) names from public.profiles p where p.role='campus' and p.status='active' and p.campus_id=c.id) leads on true
 where c.is_active and not exists(select 1 from public.reports r where r.campus_id=c.id and r.season_id=season and r.week_ending=week_date and r.submitted_at<=p_now);
 select missing || coalesce(jsonb_agg('Cluster: '||cl.name||' — '||p.full_name order by cl.name),'[]'::jsonb) into missing from public.clusters cl join public.profiles p on p.cluster_id=cl.id and p.role='cluster' and p.status='active' where cl.is_active and private.report_task_missing('cluster',cl.id,week_date,season);
 select coalesce(jsonb_agg(jsonb_build_object('campus',c.name || ' — ' || p.full_name,'submittedAt',r.submitted_at) order by c.name),'[]'::jsonb) into late
 from public.reports r join public.campuses c on c.id=r.campus_id join public.profiles p on p.id=r.submitted_by
 where c.is_active and r.season_id=season and r.week_ending=week_date and r.is_late and r.submitted_at<=p_now;
 insert into private.account_email_deliveries(user_id,recipient,full_name,reason,kind,payload)
 select p.id,p.email,p.full_name,'','weekly_digest',jsonb_build_object('weekEnding',week_date,'preparedAt',p_now,'missing',missing,'late',late)
 from public.profiles p join auth.users u on u.id=p.id
 where p.role='admin' and p.status='active' and u.email_confirmed_at is not null
 and private.is_real_reporting_email(p.email)
 on conflict do nothing;
 get diagnostics queued=row_count;
 return queued;
end $$;
