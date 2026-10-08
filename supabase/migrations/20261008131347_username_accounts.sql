alter table public.profiles add column username text check(username is null or username ~ '^[a-z0-9_]{3,30}$');
create unique index profiles_username_unique on public.profiles(lower(username)) where username is not null;
create function public.update_my_username(p_username text) returns public.profiles language plpgsql security definer set search_path='' as $$
declare v_username text:=lower(trim(p_username)); result public.profiles;
begin
 if auth.uid() is null then raise exception 'Sign in.' using errcode='42501';end if;
 if v_username is null or v_username !~ '^[a-z0-9_]{3,30}$' then raise exception 'Use 3 to 30 letters, numbers or underscores.' using errcode='22023';end if;
 update public.profiles set username=v_username where id=auth.uid() and status in ('active','pending') returning * into result;
 if result.id is null then raise exception 'Account unavailable.' using errcode='42501';end if;return result;
end $$;
revoke all on function public.update_my_username(text) from public,anon;grant execute on function public.update_my_username(text) to authenticated;
create function public.assign_pending_username(p_user_id uuid,p_username text,p_campus_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_username is null or p_username !~ '^[a-z0-9_]{3,30}$' then raise exception 'Invalid username';end if;
 if not exists(select 1 from public.campuses where id=p_campus_id and is_active) then raise exception 'Invalid campus';end if;
 update public.profiles set username=p_username where id=p_user_id and status='pending' and role='campus' and campus_id=p_campus_id and username is null and email ~ '^[a-f0-9-]{36}@accounts\.kocm\.invalid$';
 if not found then raise exception 'Invalid pending account';end if;
end $$;
create function public.resolve_username_login(p_username text) returns text language sql stable security definer set search_path='' as $$
 select u.email from public.profiles p join auth.users u on u.id=p.id where p.username=lower(trim(p_username)) limit 1
$$;
revoke all on function public.assign_pending_username(uuid,text,uuid),public.resolve_username_login(text) from public,anon,authenticated;
grant execute on function public.assign_pending_username(uuid,text,uuid),public.resolve_username_login(text) to service_role;
create table private.username_auth_usage(bucket text not null,window_start timestamptz not null,requests integer not null check(requests>0),primary key(bucket,window_start));
alter table private.username_auth_usage enable row level security;revoke all on private.username_auth_usage from public,anon,authenticated;
create function public.claim_username_auth(p_identity text,p_action text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_minute timestamptz:=date_trunc('minute',v_now);v_hour timestamptz:=date_trunc('hour',v_now);v_prefix text;
begin
 if p_identity is null or p_identity !~ '^[a-f0-9]{64}$' or p_action not in ('signup','signin','attach_email') or p_action is null then raise exception 'Invalid auth claim';end if;
 perform pg_catalog.pg_advisory_xact_lock(728103292);
 delete from private.username_auth_usage where window_start<v_hour-interval '2 hours';v_prefix:=p_action||'-'||p_identity;
 if coalesce((select requests from private.username_auth_usage where bucket=v_prefix||'-minute' and window_start=v_minute),0)>=10
 or (p_action in ('signup','attach_email') and coalesce((select requests from private.username_auth_usage where bucket=v_prefix||'-hour' and window_start=v_hour),0)>=5)
 or coalesce((select requests from private.username_auth_usage where bucket='global-minute' and window_start=v_minute),0)>=60 then return false;end if;
 insert into private.username_auth_usage values(v_prefix||'-minute',v_minute,1),(v_prefix||'-hour',v_hour,1),('global-minute',v_minute,1) on conflict(bucket,window_start) do update set requests=private.username_auth_usage.requests+1;return true;
end $$;
revoke all on function public.claim_username_auth(text,text) from public,anon,authenticated;grant execute on function public.claim_username_auth(text,text) to service_role;

-- Internal aliases never receive outbound mail.
create or replace function private.record_account_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.role,old.status,old.campus_id,old.cluster_id) is distinct from (new.role,new.status,new.campus_id,new.cluster_id) then
  insert into private.account_access_audit(user_id,actor_id,before_access,after_access)
   values(new.id,auth.uid(),jsonb_build_object('role',old.role,'status',old.status,'campus',old.campus_id,'cluster',old.cluster_id),jsonb_build_object('role',new.role,'status',new.status,'campus',new.campus_id,'cluster',new.cluster_id));
 end if;
 if new.status='rejected' and old.status is distinct from 'rejected' and lower(new.email) not like '%.invalid' then
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
 select coalesce(jsonb_agg(jsonb_build_object('campus',c.name || ' — ' || p.full_name,'submittedAt',r.submitted_at) order by c.name),'[]'::jsonb) into late
 from public.reports r join public.campuses c on c.id=r.campus_id join public.profiles p on p.id=r.submitted_by
 where c.is_active and r.season_id=season and r.week_ending=week_date and r.is_late and r.submitted_at<=p_now;
 insert into private.account_email_deliveries(user_id,recipient,full_name,reason,kind,payload)
 select p.id,p.email,p.full_name,'','weekly_digest',jsonb_build_object('weekEnding',week_date,'preparedAt',p_now,'missing',missing,'late',late)
 from public.profiles p join auth.users u on u.id=p.id
 where p.role='admin' and p.status='active' and u.email_confirmed_at is not null
 and lower(p.email) not like '%.invalid' and lower(p.email) not like '%.example' and lower(p.email) not like '%.test'
 on conflict do nothing;
 get diagnostics queued=row_count;
 return queued;
end $$;
update private.account_email_deliveries set status='cancelled',last_error=null where lower(recipient) like '%.invalid' and status in ('pending','failed');

create or replace function public.claim_account_emails()
returns setof private.account_email_deliveries language sql security definer set search_path='' as $$
 update private.account_email_deliveries d set status='sending',attempts=d.attempts+1,claimed_at=now(),last_error=null
 where d.id in (select q.id from private.account_email_deliveries q join public.profiles p on p.id=q.user_id
  where p.email=q.recipient and lower(q.recipient) not like '%.invalid' and q.attempts<5
   and ((q.kind='rejection' and p.status='rejected') or (q.kind='weekly_digest' and p.status='active' and p.role='admin'))
   and (q.status='pending' or (q.status='failed' and q.claimed_at<now()-interval '1 minute') or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
  order by q.created_at limit 3 for update of q skip locked)
 returning d.*
$$;
