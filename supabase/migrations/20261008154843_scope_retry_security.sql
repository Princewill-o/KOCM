-- Recheck current scope on idempotent retrieval and after administrative contention.
create or replace function public.submit_campus_weekly_feedback(p_week_ending date,p_answers jsonb,p_request_id uuid) returns public.campus_weekly_feedback
language plpgsql security definer set search_path='' as $$
declare me public.profiles; campus public.campuses; season public.seasons; report public.reports; saved public.campus_weekly_feedback; a jsonb:=p_answers; k text; n numeric; deadline timestamptz; v_late boolean;
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or me.status<>'active' or me.role<>'campus' or me.campus_id is null then raise exception 'An approved campus lead account is required.' using errcode='42501';end if;
 select * into campus from public.campuses where id=me.campus_id and is_active for share;
 if campus.id is null then raise exception 'Your campus is inactive.' using errcode='42501';end if;
 if p_request_id is null or a is null or jsonb_typeof(a)<>'object' or pg_column_size(a)>24000 then raise exception 'Invalid feedback request.' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(a) x where x not in ('sessionDate','startTime','endTime','lesson','attendanceExcludingLead','firstTimers','bornAgain','prayerMinutes','prayerWalk','holyGhostBaptism','tonguesRecipients','evangelismDatesTimes','evangelismMinutes','evangelismZeroReason','soulsWon','contactsTaken','contactsAttendedFellowship','homeVisits','churchAttendeesExcludingCore','churchAttendeesIncludingCore','churchFirstTimers','overallServing','newDepartmentJoiners','outreachOutings','incidentNotes','lateReason')) then raise exception 'Unexpected feedback fields.' using errcode='22023';end if;
 if a->>'holyGhostBaptism'='no' then a:=a-'tonguesRecipients';end if;
 if a->>'evangelismMinutes'<>'0' then a:=jsonb_set(a,'{evangelismZeroReason}','""'::jsonb);end if;
 foreach k in array array['attendanceExcludingLead','firstTimers','bornAgain','prayerMinutes','evangelismMinutes','soulsWon','contactsTaken','contactsAttendedFellowship','homeVisits','churchAttendeesExcludingCore','churchAttendeesIncludingCore','churchFirstTimers','overallServing','newDepartmentJoiners','outreachOutings'] loop
  if jsonb_typeof(a->k) is distinct from 'number' then raise exception 'Enter a whole number for %.',k using errcode='22023';end if;
  n:=(a->>k)::numeric;if n<>trunc(n) or n<0 or n>(case when k in ('prayerMinutes','evangelismMinutes') then 1000000 when k='outreachOutings' then 10000 else 100000 end) then raise exception 'Invalid count for %.',k using errcode='22023';end if;
 end loop;
 foreach k in array array['prayerWalk','holyGhostBaptism'] loop if jsonb_typeof(a->k) is distinct from 'string' or a->>k not in ('yes','no') then raise exception 'Choose yes or no for %.',k using errcode='22023';end if;end loop;
 if a->>'holyGhostBaptism'='yes' then if jsonb_typeof(a->'tonguesRecipients') is distinct from 'number' then raise exception 'Enter tongues recipients.' using errcode='22023';end if;n:=(a->>'tonguesRecipients')::numeric;if n<>trunc(n) or n<0 or n>100000 then raise exception 'Invalid tongues recipients.' using errcode='22023';end if;end if;
 foreach k in array array['sessionDate','startTime','endTime','lesson','evangelismDatesTimes','evangelismZeroReason','incidentNotes','lateReason'] loop
  if jsonb_typeof(a->k) is distinct from 'string' or char_length(a->>k)>(case when k in ('incidentNotes','evangelismDatesTimes') then 4000 when k in ('evangelismZeroReason','lateReason') then 1000 when k='lesson' then 200 else 10 end) then raise exception 'Invalid text for %.',k using errcode='22023';end if;
  a:=jsonb_set(a,array[k],to_jsonb(trim(a->>k)));
 end loop;
 if a->>'sessionDate' !~ '^\d{4}-\d{2}-\d{2}$' or a->>'startTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or a->>'endTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Enter valid session dates and times.' using errcode='22023';end if;
 begin perform (a->>'sessionDate')::date;exception when others then raise exception 'Enter a valid session date.' using errcode='22023';end;
 if a->>'lesson' !~* '^(week[[:space:]]+[0-9]+[[:space:]]*[:–-][[:space:]]*[^[:space:]].*|kickback([[:space:]].*)?)$' or trim(a->>'evangelismDatesTimes')='' then raise exception 'Enter the lesson and evangelism dates and times.' using errcode='22023';end if;
 if (a->>'evangelismMinutes')::int=0 and trim(a->>'evangelismZeroReason')='' then raise exception 'Explain why no evangelism took place.' using errcode='22023';end if;
 -- Serialize retries: one request ID can never create a second snapshot or update stats twice.
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended(me.id::text||p_request_id::text,0));
 select * into saved from public.campus_weekly_feedback where submitted_by=me.id and request_id=p_request_id;
 if saved.id is not null then
  if saved.campus_id is distinct from me.campus_id then raise exception 'This request belongs to a previous campus assignment.' using errcode='42501';end if;
  if saved.week_ending is distinct from p_week_ending or saved.answers is distinct from a then raise exception 'This request was already submitted with different answers.' using errcode='22023';end if;return saved;end if;
 select * into season from public.seasons where is_current;
 if season.id is null or p_week_ending is null or p_week_ending not between season.start_date and season.end_date or extract(isodow from p_week_ending)<>5 then raise exception 'Choose a Friday within the current season.' using errcode='22023';end if;
 deadline:=(p_week_ending::timestamp+make_interval(hours=>season.deadline_hour)) at time zone season.time_zone;
 v_late:=now()>=deadline;
 if v_late and trim(a->>'lateReason')='' then raise exception 'This submission is late. Please add a reason before submitting again.' using errcode='22023';end if;
 report:=public.submit_report(p_week_ending,(a->>'attendanceExcludingLead')::int,(a->>'prayerMinutes')::int,(a->>'evangelismMinutes')::int,(a->>'outreachOutings')::int,left(a->>'incidentNotes',2000),me.campus_id);
 insert into public.campus_weekly_feedback(report_id,campus_id,campus_name,submitted_by,submitter_name,week_ending,season_id,is_late,answers,request_id)
 values(report.id,me.campus_id,campus.name,me.id,me.full_name,p_week_ending,season.id,v_late,a,p_request_id) returning * into saved;return saved;
end $$;

create or replace function public.admin_update_user(
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
  perform pg_catalog.pg_advisory_xact_lock(73612061);
  -- Authority may have been revoked while this request waited for the lock.
  if (select private.my_role()) is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501'; end if;
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



revoke all on function public.submit_campus_weekly_feedback(date,jsonb,uuid),public.admin_update_user(uuid,text,text,uuid,text,uuid,text) from public,anon;
grant execute on function public.submit_campus_weekly_feedback(date,jsonb,uuid),public.admin_update_user(uuid,text,text,uuid,text,uuid,text) to authenticated;
