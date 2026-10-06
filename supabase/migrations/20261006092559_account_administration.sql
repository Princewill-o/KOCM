-- Account decisions are audited and email jobs persist independently of delivery.
alter table public.profiles add column rejection_reason text check(char_length(rejection_reason)<=1000);
create table private.account_access_audit (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 actor_id uuid references public.profiles(id), before_access jsonb not null, after_access jsonb not null,
 created_at timestamptz not null default now()
);
create table private.account_email_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 recipient text not null, full_name text not null, reason text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0, last_error text, created_at timestamptz not null default now(),
 sent_at timestamptz, claimed_at timestamptz
);
create index account_email_user_idx on private.account_email_deliveries(user_id,created_at desc);
alter table private.account_access_audit enable row level security;
alter table private.account_email_deliveries enable row level security;
revoke all on private.account_access_audit,private.account_email_deliveries from public,anon,authenticated;
create function private.record_account_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.role,old.status,old.campus_id,old.cluster_id) is distinct from (new.role,new.status,new.campus_id,new.cluster_id) then
  insert into private.account_access_audit(user_id,actor_id,before_access,after_access)
   values(new.id,auth.uid(),jsonb_build_object('role',old.role,'status',old.status,'campus',old.campus_id,'cluster',old.cluster_id),jsonb_build_object('role',new.role,'status',new.status,'campus',new.campus_id,'cluster',new.cluster_id));
 end if;
 if new.status='rejected' and old.status is distinct from 'rejected' then
  insert into private.account_email_deliveries(user_id,recipient,full_name,reason)
   values(new.id,new.email,new.full_name,coalesce(new.rejection_reason,'Your account application was not approved. Please contact KOC leadership for further information.'));
 elsif new.status <> 'rejected' then
  update private.account_email_deliveries set status='cancelled',last_error=null where user_id=new.id and status in ('pending','failed');
 end if;
 return new;
end $$;
revoke all on function private.record_account_access() from public,anon,authenticated;
create trigger account_access_changed after update on public.profiles for each row execute function private.record_account_access();
drop function public.admin_update_user(uuid,text,text,uuid,text,uuid);
create function public.admin_update_user(
  p_user_id uuid,
  p_role text default null,
  p_status text default null,
  p_campus_id uuid default null,
  p_full_name text default null,
  p_cluster_id uuid default null,
  p_rejection_reason text default null
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
  v_role text;
  v_status text;
  v_campus uuid;
  v_cluster uuid;
begin
  if (select private.my_role()) is distinct from 'admin' then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(73612061);
  if char_length(coalesce(p_rejection_reason,'')) > 1000 then raise exception 'Keep the rejection reason under 1000 characters.' using errcode='22023'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if target.id is null then raise exception 'Account not found.' using errcode = '22023'; end if;

  v_role := coalesce(p_role, target.role);
  v_status := coalesce(p_status, target.status);
  v_campus := case when v_role = 'campus' then coalesce(p_campus_id, target.campus_id) else null end;
  v_cluster := case when v_role = 'cluster' then coalesce(p_cluster_id, target.cluster_id) else null end;
  if v_role = 'cluster' and (v_cluster is null or not exists(select 1 from public.clusters where id=v_cluster and is_active)) then raise exception 'Cluster leads need an active cluster.' using errcode='22023'; end if;
  if v_role not in ('admin', 'editor', 'campus','cluster') then raise exception 'Invalid role.' using errcode = '22023'; end if;
  if v_status not in ('pending', 'active', 'rejected') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if v_role = 'campus' and (v_campus is null or not exists (select 1 from public.campuses where id = v_campus)) then
    raise exception 'Campus representatives need a university.' using errcode = '22023';
  end if;

  -- Never leave the system without an active administrator.
  if target.role = 'admin' and target.status = 'active' and (v_role <> 'admin' or v_status <> 'active')
     and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
    raise exception 'At least one active administrator is required.' using errcode = '42501';
  end if;

  update public.profiles set
    role = v_role, status = v_status, campus_id = v_campus, cluster_id = v_cluster,
    rejection_reason = case when v_status = 'rejected' then coalesce(nullif(trim(p_rejection_reason),''),'Your account application was not approved. Please contact KOC leadership for further information.') else null end,
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = p_user_id
  returning * into target;
  return target;
end $$;


revoke all on function public.admin_update_user(uuid,text,text,uuid,text,uuid,text) from public,anon;
grant execute on function public.admin_update_user(uuid,text,text,uuid,text,uuid,text) to authenticated;


create function public.list_account_email_deliveries()
returns table(id uuid,user_id uuid,status text,last_error text,created_at timestamptz,sent_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if (select private.my_role()) is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501'; end if;
 return query select d.id,d.user_id,d.status,d.last_error,d.created_at,d.sent_at from private.account_email_deliveries d order by d.created_at desc limit 500;
end $$;
revoke all on function public.list_account_email_deliveries() from public,anon;
grant execute on function public.list_account_email_deliveries() to authenticated;
-- Worker functions are inaccessible to browser clients, including administrators.
create function public.claim_account_emails()
returns setof private.account_email_deliveries language sql security definer set search_path='' as $$
 update private.account_email_deliveries d set status='sending',attempts=d.attempts+1,claimed_at=now(),last_error=null
 where d.id in (select q.id from private.account_email_deliveries q join public.profiles p on p.id=q.user_id
  where p.status='rejected' and p.email=q.recipient and q.attempts<5
   and (q.status in ('pending','failed') or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
  order by q.created_at limit 10 for update of q skip locked)
 returning d.*
$$;
create function public.complete_account_email(p_id uuid,p_sent boolean,p_error text default null)
returns void language sql security definer set search_path='' as $$
 update private.account_email_deliveries set status=case when p_sent then 'sent' else 'failed' end,
 sent_at=case when p_sent then now() else null end,last_error=case when p_sent then null else left(coalesce(p_error,'Email delivery failed.'),300) end
 where id=p_id and status='sending'
$$;
revoke all on function public.claim_account_emails(),public.complete_account_email(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_account_emails(),public.complete_account_email(uuid,boolean,text) to service_role;
-- One-time invitations only activate after Supabase verifies ownership of the exact email.
create table private.admin_invitations (
 email text primary key, user_id uuid unique references auth.users(id),
 expires_at timestamptz not null default now()+interval '7 days', consumed_at timestamptz
);
alter table private.admin_invitations enable row level security;
revoke all on private.admin_invitations from public,anon,authenticated;
create function private.activate_admin_invitation() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation private.admin_invitations;
begin
 select * into invitation from private.admin_invitations where email=lower(new.email) and consumed_at is null and expires_at>now() for update;
 if invitation.email is null then return new; end if;
 if tg_op='INSERT' and invitation.user_id is null then
  update private.admin_invitations set user_id=new.id where email=invitation.email;
  invitation.user_id:=new.id;
 end if;
 if invitation.user_id=new.id and new.email_confirmed_at is not null then
  update public.profiles set role='admin',status='active',campus_id=null,cluster_id=null where id=new.id;
  update private.admin_invitations set consumed_at=now() where email=invitation.email;
 end if;
 return new;
end $$;
revoke all on function private.activate_admin_invitation() from public,anon,authenticated;
-- Sorted after on_auth_user_created, so the profile exists before activation.
create trigger zz_activate_admin_invitation after insert or update of email_confirmed_at on auth.users
 for each row execute function private.activate_admin_invitation();

-- Cluster submissions stay attached to a campus and use the same audit/deadline rules.
create or replace function private.enforce_report_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select private.my_role())='cluster' and not private.can_access_campus(new.campus_id) then
  raise exception 'You can only submit reports for your assigned cluster.' using errcode='42501';
 end if;
 if tg_op='INSERT' then
  new.submitted_at:=now();
  new.is_late:=now()>public.report_deadline(new.week_ending,new.season_id);
 end if;
 return new;
end $$;
create or replace function public.submit_report(
  p_week_ending date,
  p_attendance int,
  p_prayer_minutes int,
  p_evangelism_minutes int,
  p_outreach_outings int,
  p_notes text default '',
  p_campus_id uuid default null
) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  s public.seasons;
  v_campus uuid;
  v_open timestamptz;
  v_deadline timestamptz;
  v_notes text := trim(coalesce(p_notes, ''));
  r public.reports;
begin
  select * into me from public.profiles where id = (select auth.uid());
  if me.id is null then raise exception 'Please log in.' using errcode = '28000'; end if;
  if me.status <> 'active' then raise exception 'Your account must be approved before submitting reports.' using errcode = '42501'; end if;

  if me.role = 'campus' then
    if p_campus_id is not null and p_campus_id <> me.campus_id then
      raise exception 'You can only submit reports for your own university.' using errcode = '42501';
    end if;
    v_campus := me.campus_id;
  else
    v_campus := p_campus_id;
    if v_campus is null then raise exception 'Select a university.' using errcode = '22023'; end if;
  end if;
  if not exists (select 1 from public.campuses where id = v_campus and is_active) then
    raise exception 'University not found or inactive.' using errcode = '22023';
  end if;

  if not private.can_access_campus(v_campus) then raise exception 'You can only submit reports for campuses assigned to you.' using errcode='42501'; end if;

  select * into s from public.seasons where is_current;
  if s.id is null then raise exception 'No reporting season is open.' using errcode = '22023'; end if;
  if p_week_ending is null or p_week_ending < s.start_date or p_week_ending > s.end_date then
    raise exception 'Choose a week in the reporting season.' using errcode = '22023';
  end if;
  if extract(isodow from p_week_ending) <> 5 then
    raise exception 'Reports must end on a Friday.' using errcode = '22023';
  end if;
  v_open := ((p_week_ending - 6)::timestamp) at time zone s.time_zone;
  if now() < v_open then raise exception 'This reporting week has not started yet.' using errcode = '22023'; end if;

  if p_attendance is null or p_attendance not between 0 and 100000
     or p_prayer_minutes is null or p_prayer_minutes not between 0 and 1000000
     or p_evangelism_minutes is null or p_evangelism_minutes not between 0 and 1000000
     or p_outreach_outings is null or p_outreach_outings not between 0 and 10000 then
    raise exception 'Enter whole numbers of zero or more.' using errcode = '22023';
  end if;
  if char_length(v_notes) > 2000 then raise exception 'Notes must be 2000 characters or fewer.' using errcode = '22023'; end if;

  v_deadline := (p_week_ending::timestamp + make_interval(hours => s.deadline_hour)) at time zone s.time_zone;

  insert into public.reports as t (campus_id, season_id, week_ending, attendance, prayer_minutes, evangelism_minutes,
                                   outreach_outings, notes, submitted_by, updated_by, submitted_at, updated_at, is_late)
  values (v_campus, s.id, p_week_ending, p_attendance, p_prayer_minutes, p_evangelism_minutes,
          p_outreach_outings, v_notes, me.id, me.id, now(), now(), now() >= v_deadline)
  on conflict (campus_id, season_id, week_ending) do update set
    attendance = excluded.attendance,
    prayer_minutes = excluded.prayer_minutes,
    evangelism_minutes = excluded.evangelism_minutes,
    outreach_outings = excluded.outreach_outings,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into r;

  insert into public.report_audit (report_id, actor_id, snapshot) values (r.id, me.id, to_jsonb(r));
  return r;
end $$;
