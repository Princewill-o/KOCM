-- Immutable answers accompany mutable weekly metrics; identities come from Auth.
create table public.campus_weekly_feedback(
 id uuid primary key default gen_random_uuid(),report_id uuid not null references public.reports(id) on delete restrict,
 campus_id uuid not null references public.campuses(id),campus_name text not null,submitted_by uuid not null references public.profiles(id),submitter_name text not null,
 week_ending date not null,season_id text not null references public.seasons(id),is_late boolean not null,answers jsonb not null,
 request_id uuid not null,created_at timestamptz not null default now(),unique(submitted_by,request_id)
);
create index campus_weekly_feedback_scope on public.campus_weekly_feedback(campus_id,created_at desc);
alter table public.campus_weekly_feedback enable row level security;
revoke all on public.campus_weekly_feedback from public,anon,authenticated;
grant select on public.campus_weekly_feedback to authenticated;
create policy "Scoped campus feedback reads" on public.campus_weekly_feedback for select to authenticated using(private.can_access_campus(campus_id));
create function public.submit_campus_weekly_feedback(p_week_ending date,p_answers jsonb,p_request_id uuid) returns public.campus_weekly_feedback
language plpgsql security definer set search_path='' as $$
declare me public.profiles; campus public.campuses; season public.seasons; report public.reports; saved public.campus_weekly_feedback; a jsonb:=p_answers; k text; n numeric; deadline timestamptz; v_late boolean;
begin
 select * into me from public.profiles where id=auth.uid();
 if me.id is null or me.status<>'active' or me.role<>'campus' or me.campus_id is null then raise exception 'An approved campus lead account is required.' using errcode='42501';end if;
 select * into campus from public.campuses where id=me.campus_id and is_active;
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
 if saved.id is not null then if saved.week_ending is distinct from p_week_ending or saved.answers is distinct from a then raise exception 'This request was already submitted with different answers.' using errcode='22023';end if;return saved;end if;
 select * into season from public.seasons where is_current;
 if season.id is null or p_week_ending is null or p_week_ending not between season.start_date and season.end_date or extract(isodow from p_week_ending)<>5 then raise exception 'Choose a Friday within the current season.' using errcode='22023';end if;
 deadline:=(p_week_ending::timestamp+make_interval(hours=>season.deadline_hour)) at time zone season.time_zone;
 v_late:=now()>=deadline;
 if v_late and trim(a->>'lateReason')='' then raise exception 'This submission is late. Please add a reason before submitting again.' using errcode='22023';end if;
 report:=public.submit_report(p_week_ending,(a->>'attendanceExcludingLead')::int,(a->>'prayerMinutes')::int,(a->>'evangelismMinutes')::int,(a->>'outreachOutings')::int,left(a->>'incidentNotes',2000),me.campus_id);
 insert into public.campus_weekly_feedback(report_id,campus_id,campus_name,submitted_by,submitter_name,week_ending,season_id,is_late,answers,request_id)
 values(report.id,me.campus_id,campus.name,me.id,me.full_name,p_week_ending,season.id,v_late,a,p_request_id) returning * into saved;return saved;
end $$;
revoke all on function public.submit_campus_weekly_feedback(date,jsonb,uuid) from public,anon;
grant execute on function public.submit_campus_weekly_feedback(date,jsonb,uuid) to authenticated;
