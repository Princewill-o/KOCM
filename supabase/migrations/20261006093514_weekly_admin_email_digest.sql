-- A durable Friday 23:00 UK summary and an authenticated server-only delivery scheduler.
alter table private.account_email_deliveries add column kind text not null default 'rejection' check(kind in ('rejection','weekly_digest')),
 add column payload jsonb not null default '{}';
create unique index one_weekly_digest_per_admin on private.account_email_deliveries(user_id,(payload->>'weekEnding')) where kind='weekly_digest';
create or replace function public.claim_account_emails()
returns setof private.account_email_deliveries language sql security definer set search_path='' as $$
 update private.account_email_deliveries d set status='sending',attempts=d.attempts+1,claimed_at=now(),last_error=null
 where d.id in (select q.id from private.account_email_deliveries q join public.profiles p on p.id=q.user_id
  where p.email=q.recipient and q.attempts<5
   and ((q.kind='rejection' and p.status='rejected') or (q.kind='weekly_digest' and p.status='active' and p.role='admin'))
   and (q.status='pending' or (q.status='failed' and q.claimed_at<now()-interval '1 minute') or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
  order by q.created_at limit 3 for update of q skip locked)
 returning d.*
$$;
-- Approval cancels only obsolete rejection messages, not a valid weekly digest.
create or replace function private.record_account_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.role,old.status,old.campus_id,old.cluster_id) is distinct from (new.role,new.status,new.campus_id,new.cluster_id) then
  insert into private.account_access_audit(user_id,actor_id,before_access,after_access)
   values(new.id,auth.uid(),jsonb_build_object('role',old.role,'status',old.status,'campus',old.campus_id,'cluster',old.cluster_id),jsonb_build_object('role',new.role,'status',new.status,'campus',new.campus_id,'cluster',new.cluster_id));
 end if;
 if new.status='rejected' and old.status is distinct from 'rejected' then
  insert into private.account_email_deliveries(user_id,recipient,full_name,reason)
   values(new.id,new.email,new.full_name,coalesce(new.rejection_reason,'Your account application was not approved. Please contact KOC leadership for further information.'));
 elsif new.status <> 'rejected' then
  update private.account_email_deliveries set status='cancelled',last_error=null where user_id=new.id and kind='rejection' and status in ('pending','failed');
 end if;
 if new.role<>'admin' or new.status<>'active' then
  update private.account_email_deliveries set status='cancelled',last_error=null where user_id=new.id and kind='weekly_digest' and status in ('pending','failed');
 end if;
 return new;
end $$;
create function private.queue_weekly_admin_digest(p_now timestamptz default now()) returns integer
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
 select coalesce(jsonb_agg(jsonb_build_object('campus',c.name || ' — ' || p.full_name,'submittedAt',r.submitted_at) order by c.name),'[]'::jsonb) into late
 from public.reports r join public.campuses c on c.id=r.campus_id join public.profiles p on p.id=r.submitted_by
 where c.is_active and r.season_id=season and r.week_ending=week_date and r.is_late and r.submitted_at<=p_now;
 insert into private.account_email_deliveries(user_id,recipient,full_name,reason,kind,payload)
 select p.id,p.email,p.full_name,'','weekly_digest',jsonb_build_object('weekEnding',week_date,'preparedAt',p_now,'missing',missing,'late',late)
 from public.profiles p join auth.users u on u.id=p.id
 where p.role='admin' and p.status='active' and u.email_confirmed_at is not null
 and lower(p.email) not like '%.example' and lower(p.email) not like '%.test'
 on conflict do nothing;
 get diagnostics queued=row_count;
 return queued;
end $$;
revoke all on function private.queue_weekly_admin_digest(timestamptz) from public,anon,authenticated;
-- Store the scheduler credential encrypted in Vault; never send it to a browser.
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='koc_account_email_worker') then
  perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),'koc_account_email_worker','KOC email cron worker credential');
 end if;
end $$;
create function public.verify_account_email_worker(p_token text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_token is not null and length(p_token)=64 and exists(select 1 from vault.decrypted_secrets where name='koc_account_email_worker' and decrypted_secret=p_token)
$$;
revoke all on function public.verify_account_email_worker(text) from public,anon,authenticated;
grant execute on function public.verify_account_email_worker(text) to service_role;
-- Disposable tests use stubs; production uses Supabase's supported extensions.
do $$ begin
 if current_database() !~ '^koc_workflow_test_[a-f0-9]+$' then
  create extension if not exists pg_cron with schema pg_catalog;
  create extension if not exists pg_net with schema extensions;
 end if;
end $$;
create function private.run_account_email_schedule() returns void
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 perform private.queue_weekly_admin_digest();
 if exists(select 1 from private.account_email_deliveries where attempts<5 and status in ('pending','failed','sending')) then
  select decrypted_secret into token from vault.decrypted_secrets where name='koc_account_email_worker';
  perform net.http_post(url:='https://yrqkafiqwllkphroztqk.supabase.co/functions/v1/account-email-delivery',
   headers:=jsonb_build_object('Content-Type','application/json','X-KOC-Worker-Token',token),body:='{}'::jsonb,timeout_milliseconds:=100000);
 end if;
end $$;
revoke all on function private.run_account_email_schedule() from public,anon,authenticated;
select cron.schedule('koc-account-email-delivery','*/15 * * * *','select private.run_account_email_schedule()');
