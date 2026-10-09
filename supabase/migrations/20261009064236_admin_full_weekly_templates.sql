-- Extend identical full weekly templates to real administrators without impersonating leads.
-- No direct table write grants or read policies change.
drop function public.submit_campus_weekly_feedback(date,jsonb,uuid);
drop function public.submit_cluster_report(jsonb,uuid,date);
drop function public.submit_cluster_report_unperioded(jsonb,uuid);
create function public.submit_campus_weekly_feedback(p_week_ending date,p_answers jsonb,p_request_id uuid,p_campus_id uuid default null) returns public.campus_weekly_feedback
language plpgsql security definer set search_path='' as $$
declare me public.profiles; target_campus uuid; campus public.campuses; season public.seasons; report public.reports; saved public.campus_weekly_feedback; a jsonb:=p_answers; k text; n numeric; deadline timestamptz; v_late boolean;
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or me.status<>'active' or me.role not in ('admin','campus') then raise exception 'An active administrator or approved campus lead account is required.' using errcode='42501';end if;
 if me.role='campus' then
  if me.campus_id is null or (p_campus_id is not null and p_campus_id<>me.campus_id) then raise exception 'You can only submit feedback for your current campus.' using errcode='42501';end if;
  target_campus:=me.campus_id;
 else
  target_campus:=p_campus_id;
  if target_campus is null then raise exception 'Select an active campus.' using errcode='22023';end if;
 end if;
 select * into campus from public.campuses where id=target_campus and is_active for share;
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
  if saved.campus_id is distinct from target_campus then raise exception 'This request belongs to a previous campus assignment.' using errcode='42501';end if;
  if saved.week_ending is distinct from p_week_ending or saved.answers is distinct from a then raise exception 'This request was already submitted with different answers.' using errcode='22023';end if;return saved;end if;
 select * into season from public.seasons where is_current;
 if season.id is null or p_week_ending is null or p_week_ending not between season.start_date and season.end_date or extract(isodow from p_week_ending)<>5 then raise exception 'Choose a Friday within the current season.' using errcode='22023';end if;
 deadline:=(p_week_ending::timestamp+make_interval(hours=>season.deadline_hour)) at time zone season.time_zone;
 v_late:=now()>=deadline;
 if v_late and trim(a->>'lateReason')='' then raise exception 'This submission is late. Please add a reason before submitting again.' using errcode='22023';end if;
 report:=public.submit_report(p_week_ending,(a->>'attendanceExcludingLead')::int,(a->>'prayerMinutes')::int,(a->>'evangelismMinutes')::int,(a->>'outreachOutings')::int,left(a->>'incidentNotes',2000),target_campus);
 insert into public.campus_weekly_feedback(report_id,campus_id,campus_name,submitted_by,submitter_name,week_ending,season_id,is_late,answers,request_id)
 values(report.id,target_campus,campus.name,me.id,me.full_name,p_week_ending,season.id,v_late,a,p_request_id) returning * into saved;return saved;
end $$;


create function private.submit_cluster_report_unperioded(p_answers jsonb,p_request_id uuid,p_cluster_id uuid) returns public.cluster_reports
language plpgsql security definer set search_path='' as $function$
declare
 me public.profiles;target_cluster uuid; result public.cluster_reports; v_scope text; v_campus uuid;
 contract jsonb := $contract$[{"id":"session","title":"KOC Session","required":true,"questions":[{"id":"session.leader","label":"Who led the session?","kind":"text","required":false},{"id":"session.date","label":"Date of session","kind":"date","required":false},{"id":"session.start","label":"Start time","kind":"time","required":false},{"id":"session.finish","label":"Finish time","kind":"time","required":false},{"id":"session.lesson","label":"Lesson (week number: title, or Kickback)","kind":"text","required":false},{"id":"session.atmosphere","label":"Were there issues with the atmosphere?","kind":"decision","required":false},{"id":"session.atmosphere.description","label":"Please explain","kind":"text","required":true,"when":"session.atmosphere","answer":"yes"},{"id":"session.core","label":"Were there issues with core involvement?","kind":"decision","required":false},{"id":"session.core.description","label":"Please explain","kind":"text","required":false,"when":"session.core","answer":"yes"},{"id":"session.engagement","label":"Were there issues with member engagement?","kind":"decision","required":false},{"id":"session.engagement.description","label":"Please explain","kind":"text","required":false,"when":"session.engagement","answer":"yes"},{"id":"session.organisation","label":"Were there issues with session organisation?","kind":"decision","required":false},{"id":"session.organisation.description","label":"Please explain","kind":"text","required":true,"when":"session.organisation","answer":"yes"},{"id":"session.positives","label":"Were there positives to highlight?","kind":"decision","required":false},{"id":"session.positives.description","label":"Please explain","kind":"text","required":false,"when":"session.positives","answer":"yes"},{"id":"session.concerns","label":"Were there other concerns?","kind":"decision","required":false},{"id":"session.concerns.description","label":"Please explain","kind":"text","required":false,"when":"session.concerns","answer":"yes"}]},{"id":"evangelism","title":"Evangelism","required":false,"questions":[{"id":"evangelism.date","label":"Date of evangelism","kind":"date","required":false},{"id":"evangelism.duration","label":"Evangelism duration (minutes)","kind":"duration","required":true},{"id":"evangelism.members","label":"Members who attended evangelism","kind":"count","required":true},{"id":"evangelism.souls","label":"Souls won","kind":"count","required":true},{"id":"evangelism.contacts","label":"Contacts taken","kind":"count","required":true},{"id":"evangelism.issues","label":"Were there any evangelism issues?","kind":"decision","required":false},{"id":"evangelism.word","label":"Issues with Word content?","kind":"decision","required":false,"when":"evangelism.issues","answer":"yes"},{"id":"evangelism.word.description","label":"Please explain","kind":"text","required":true,"when":"evangelism.word","answer":"yes"},{"id":"evangelism.confidence","label":"Issues with member or leader confidence?","kind":"decision","required":false,"when":"evangelism.issues","answer":"yes"},{"id":"evangelism.confidence.description","label":"Please explain","kind":"text","required":true,"when":"evangelism.confidence","answer":"yes"},{"id":"evangelism.other","label":"Other evangelism issues?","kind":"decision","required":false,"when":"evangelism.issues","answer":"yes"},{"id":"evangelism.other.description","label":"Please explain","kind":"text","required":true,"when":"evangelism.other","answer":"yes"}]},{"id":"prayer","title":"Prayer Meeting","required":true,"questions":[{"id":"prayer.date","label":"Date of prayer meeting","kind":"date","required":true},{"id":"prayer.duration","label":"Prayer meeting duration (minutes)","kind":"duration","required":true},{"id":"prayer.attendees","label":"Prayer meeting attendees","kind":"count","required":true},{"id":"prayer.intensity","label":"Issues with intensity or enthusiasm?","kind":"decision","required":true},{"id":"prayer.intensity.description","label":"Please explain","kind":"text","required":true,"when":"prayer.intensity","answer":"yes"},{"id":"prayer.resistance","label":"Areas of concern or resistance?","kind":"decision","required":true},{"id":"prayer.resistance.description","label":"Please explain","kind":"text","required":true,"when":"prayer.resistance","answer":"yes"},{"id":"prayer.topics","label":"Issues with prayer topics or scriptures?","kind":"decision","required":true},{"id":"prayer.topics.description","label":"Please explain","kind":"text","required":true,"when":"prayer.topics","answer":"yes"}]},{"id":"followup","title":"Follow Up","required":false,"questions":[{"id":"followup.date","label":"Date of follow up","kind":"date","required":false},{"id":"followup.nature","label":"Nature of follow up","kind":"nature","required":false},{"id":"followup.duration","label":"Follow up duration (minutes)","kind":"duration","required":true},{"id":"followup.accountability","label":"Accountability issues?","kind":"decision","required":true},{"id":"followup.accountability.description","label":"Please explain","kind":"text","required":true,"when":"followup.accountability","answer":"yes"},{"id":"followup.academic","label":"Academic progress issues?","kind":"decision","required":true},{"id":"followup.academic.description","label":"Please explain","kind":"text","required":true,"when":"followup.academic","answer":"yes"},{"id":"followup.organisation","label":"Organisation or daily routine issues?","kind":"decision","required":true},{"id":"followup.organisation.description","label":"Please explain","kind":"text","required":true,"when":"followup.organisation","answer":"yes"},{"id":"followup.financial","label":"Financial issues?","kind":"decision","required":true},{"id":"followup.financial.description","label":"Please explain","kind":"text","required":true,"when":"followup.financial","answer":"yes"},{"id":"followup.familial","label":"Familial issues?","kind":"decision","required":true},{"id":"followup.familial.description","label":"Please explain","kind":"text","required":true,"when":"followup.familial","answer":"yes"}]},{"id":"core","title":"Core Team Meeting","required":true,"questions":[{"id":"core.date","label":"Date of core team meeting","kind":"date","required":false},{"id":"core.members","label":"Total core team members","kind":"count","required":true},{"id":"core.nature","label":"Nature of core team meeting","kind":"nature","required":false},{"id":"core.duration","label":"Core team meeting duration (minutes)","kind":"duration","required":true},{"id":"core.organised","label":"Was the meeting well organised?","kind":"decision","required":true},{"id":"core.organised.description","label":"Please explain","kind":"text","required":true,"when":"core.organised","answer":"no"},{"id":"core.planning","label":"Fellowship planning issues?","kind":"decision","required":true},{"id":"core.planning.description","label":"Please explain","kind":"text","required":true,"when":"core.planning","answer":"yes"},{"id":"core.weight","label":"Members not pulling their weight?","kind":"decision","required":true},{"id":"core.weight.description","label":"List the members","kind":"text","required":true,"when":"core.weight","answer":"yes"},{"id":"core.financial","label":"Financial concerns?","kind":"decision","required":true},{"id":"core.financial.description","label":"Please explain","kind":"text","required":true,"when":"core.financial","answer":"yes"},{"id":"core.academic","label":"Academic concerns?","kind":"decision","required":true},{"id":"core.academic.description","label":"Please explain","kind":"text","required":true,"when":"core.academic","answer":"yes"},{"id":"core.prayer","label":"Prayer concerns?","kind":"decision","required":true},{"id":"core.prayer.description","label":"Please explain","kind":"text","required":true,"when":"core.prayer","answer":"yes"},{"id":"core.attended","label":"Core members who attended","kind":"count","required":true},{"id":"core.missing","label":"Core members missing","kind":"count","required":true}]},{"id":"incident","title":"Incident","required":true,"questions":[{"id":"incident.description","label":"Describe the incident","kind":"text","required":true}]}]$contract$::jsonb;
 area jsonb; question jsonb; selected jsonb; clean jsonb; visible text[]; decision text; value text; question_id text; v_date date;
begin
 select * into me from public.profiles where id=auth.uid() for share;
 if me.id is null or me.status<>'active' or me.role not in ('admin','cluster') then
 raise exception 'An active administrator or assigned cluster lead is required.' using errcode='42501'; end if;
 if me.role='cluster' then
  if me.cluster_id is null or (p_cluster_id is not null and p_cluster_id<>me.cluster_id) then raise exception 'You can only submit for your current cluster.' using errcode='42501';end if;
  target_cluster:=me.cluster_id;
 else
  target_cluster:=p_cluster_id;
  if target_cluster is null then raise exception 'Select an active cluster.' using errcode='22023';end if;
 end if;
 perform 1 from public.clusters where id=target_cluster and is_active for share;
 if not found or not exists(select 1 from public.campuses where cluster_id=target_cluster and is_active) then raise exception 'Choose an active cluster with active campuses.' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Submission request ID required.' using errcode='22023'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>65536 then
 raise exception 'Report must be a JSON object under 64 KB.' using errcode='22023'; end if;
 v_scope := p_answers->>'scope';
 if v_scope is null or v_scope not in ('cluster','campus') then raise exception 'Choose reporting scope.' using errcode='22023'; end if;
 begin v_campus:=nullif(p_answers->>'campusId','')::uuid; exception when invalid_text_representation then raise exception 'Invalid campus.' using errcode='22023'; end;
 if (v_scope='campus' and v_campus is null) or (v_campus is not null and not exists(
 select 1 from public.campuses where id=v_campus and cluster_id=target_cluster and is_active)) then
 raise exception 'Choose an active campus in your cluster.' using errcode='42501'; end if;
 selected:=p_answers->'areas';
 if jsonb_typeof(selected) is distinct from 'array' then raise exception 'Choose reporting areas.' using errcode='22023'; end if;
 if jsonb_array_length(selected)=0 or exists(select 1 from jsonb_array_elements(selected) x where jsonb_typeof(x)<>'string' or not exists(select 1 from jsonb_array_elements(contract) a where a->>'id'=x#>>'{}')) then
 raise exception 'Invalid reporting areas.' using errcode='22023'; end if;
 -- Campus reports cover all six areas, even if the client omits sections.
 if v_scope='campus' then select jsonb_agg(a->'id') into selected from jsonb_array_elements(contract) a; end if;
 clean:=jsonb_build_object('scope',v_scope,'campusId',coalesce(v_campus::text,''),'areas',selected);
 for area in select a from jsonb_array_elements(contract) a loop
 if not selected ? (area->>'id') then continue; end if;
 decision:=p_answers->>(area->>'id');
 if (area->>'required')::boolean and (decision is null or decision not in ('yes','no')) then raise exception 'Required area decision missing: %',area->>'id' using errcode='22023'; end if;
 if decision is not null and decision not in ('yes','no','') then raise exception 'Invalid area decision.' using errcode='22023'; end if;
 if decision in ('yes','no') then clean:=clean||jsonb_build_object(area->>'id',decision); end if;
 if decision is distinct from 'yes' then continue; end if;
 visible:=array[]::text[];
 for question in select q from jsonb_array_elements(area->'questions') q loop
 question_id:=question->>'id';
 if question ? 'when' and (not ((question->>'when')=any(visible)) or p_answers->>(question->>'when') is distinct from question->>'answer') then continue; end if;
 visible:=array_append(visible,question_id);
 if p_answers ? question_id and jsonb_typeof(p_answers->question_id)<>'string' then raise exception 'Answers must be text: %',question_id using errcode='22023'; end if;
 value:=trim(coalesce(p_answers->>question_id,''));
 if coalesce((question->>'required')::boolean,false) and value='' then raise exception 'Required answer missing: %',question_id using errcode='22023'; end if;
 if length(value)>4000 then raise exception 'Answer exceeds 4000 characters.' using errcode='22023'; end if;
 if value<>'' then
 case question->>'kind'
 when 'count' then if value !~ '^[0-9]+$' then raise exception 'Counts must be whole nonnegative numbers.' using errcode='22023'; end if;
 when 'duration' then if value !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Duration must be nonnegative minutes.' using errcode='22023'; end if;
 when 'decision' then if value not in ('yes','no') then raise exception 'Choose Yes or No.' using errcode='22023'; end if;
 when 'nature' then if value not in ('inperson','virtual') then raise exception 'Invalid meeting nature.' using errcode='22023'; end if;
 when 'date' then
 if value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date.' using errcode='22023'; end if;
 begin v_date:=value::date; exception when others then raise exception 'Invalid date.' using errcode='22023'; end;
 when 'time' then if value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid time.' using errcode='22023'; end if;
 else null; end case;
 end if;
 if p_answers ? question_id then clean:=clean||jsonb_build_object(question_id,value); end if;
 end loop;
 end loop;
 insert into public.cluster_reports(request_id,cluster_id,campus_id,scope,answers,submitted_by,submitter_name,submitter_email)
 values(p_request_id,target_cluster,v_campus,v_scope,clean,me.id,me.full_name,me.email) on conflict(submitted_by,request_id) do nothing returning * into result;
 if result.id is not null then
 insert into public.notifications(recipient_id,kind,title,message,campus_id,cluster_report_id)
 select p.id,'cluster_report','Cluster report submitted',me.full_name||' submitted a cluster report.',v_campus,result.id from public.profiles p where p.status='active' and p.role='admin';
 end if;
 if result.id is null then select * into result from public.cluster_reports where submitted_by=me.id and request_id=p_request_id;
 if result.cluster_id is distinct from target_cluster then raise exception 'Request belongs to a previous cluster assignment.' using errcode='42501'; end if;
 if result.answers is distinct from clean then raise exception 'Request ID already used for a different report.' using errcode='22023'; end if; end if;
 return result;
end $function$;

create function public.submit_cluster_report(p_answers jsonb,p_request_id uuid,p_week_ending date default null,p_cluster_id uuid default null) returns public.cluster_reports language plpgsql security definer set search_path='' as $$
declare week date:=p_week_ending; s public.seasons; r public.cluster_reports; old public.cluster_reports; uk date:=(now() at time zone 'Europe/London')::date;
begin
 select * into s from public.seasons where is_current;
 if week is null then week:=uk+((5-extract(isodow from uk)::int+7)%7);end if;
 if s.id is null or week not between s.start_date and s.end_date or extract(isodow from week)<>5 or now()<((week-6)::timestamp at time zone s.time_zone) then raise exception 'Choose an open Friday in the current reporting season.' using errcode='22023';end if;
 if auth.uid() is null then raise exception 'Sign in.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('cluster-period-'||auth.uid()::text||p_request_id::text,0));
 select * into old from public.cluster_reports where submitted_by=auth.uid() and request_id=p_request_id;
 if old.id is not null and old.week_ending is distinct from week then raise exception 'Request belongs to a different reporting week.' using errcode='22023';end if;
 r:=private.submit_cluster_report_unperioded(p_answers,p_request_id,p_cluster_id);
 if old.id is null then
  update public.cluster_reports set week_ending=week,season_id=s.id,is_late=created_at>=((week::timestamp+make_interval(hours=>s.deadline_hour)) at time zone s.time_zone) where id=r.id returning * into r;
  if r.is_late then update public.notifications set title='Late cluster report submitted',message=r.submitter_name||' submitted a cluster report after Friday 10pm UK time.' where cluster_report_id=r.id;end if;
 end if;return r;
end $$;

revoke all on function private.submit_cluster_report_unperioded(jsonb,uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_campus_weekly_feedback(date,jsonb,uuid,uuid),public.submit_cluster_report(jsonb,uuid,date,uuid) from public,anon;
grant execute on function public.submit_campus_weekly_feedback(date,jsonb,uuid,uuid),public.submit_cluster_report(jsonb,uuid,date,uuid) to authenticated;
