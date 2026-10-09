begin;
do $$
declare admin_id uuid:=gen_random_uuid();campus_lead uuid:=gen_random_uuid();cluster_lead uuid:=gen_random_uuid();editor_id uuid:=gen_random_uuid();campus uuid;other_campus uuid;cluster uuid;other_cluster uuid;week date;request uuid:=gen_random_uuid();a jsonb;feedback public.campus_weekly_feedback;r public.cluster_reports;
begin
 select id,cluster_id into campus,cluster from public.campuses where is_active and cluster_id is not null limit 1;
 select id into other_cluster from public.clusters where is_active and id<>cluster limit 1;
 select id into other_campus from public.campuses where is_active and cluster_id=other_cluster limit 1;
 select start_date into week from public.seasons where is_current;
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 (admin_id,'templates-admin@example.test','{"koc_role":"admin"}','{"full_name":"Actual Administrator"}'),
 (editor_id,'templates-editor@example.test','{"koc_role":"editor"}','{}'),
 (campus_lead,'templates-campus@example.test','{}',jsonb_build_object('campus_id',campus,'full_name','Campus Lead')),
 (cluster_lead,'templates-cluster@example.test','{}','{}');
 update public.profiles set status='active' where id=campus_lead;
 update public.profiles set role='cluster',cluster_id=cluster,status='active' where id=cluster_lead;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 a:=jsonb_build_object('sessionDate',week::text,'startTime','18:00','endTime','19:00','lesson','Week 1: Prayer','attendanceExcludingLead',4,'firstTimers',1,'bornAgain',0,'prayerMinutes',30,'prayerWalk','no','holyGhostBaptism','no','tonguesRecipients',999,'evangelismDatesTimes','Thursday 12pm','evangelismMinutes',20,'evangelismZeroReason','','soulsWon',0,'contactsTaken',2,'contactsAttendedFellowship',1,'homeVisits',0,'churchAttendeesExcludingCore',2,'churchAttendeesIncludingCore',4,'churchFirstTimers',0,'overallServing',1,'newDepartmentJoiners',0,'outreachOutings',1,'incidentNotes','Incident detail','lateReason','Test submitted later');
 feedback:=public.submit_campus_weekly_feedback(week,a,request,campus);
 if not feedback.is_late or not (select is_late from public.reports where id=feedback.report_id) then raise exception 'Admin campus late status missing';end if;
 if (select count(*) from public.notifications where report_id=feedback.report_id and kind='late_report' and recipient_id in(admin_id,editor_id))<>2 then raise exception 'Admin campus late alert missing overall recipients';end if;
 if feedback.campus_id<>campus or feedback.submitted_by<>admin_id or feedback.submitter_name<>'Actual Administrator' then raise exception 'Admin campus submission impersonated lead or wrong entity';end if;
 if (select count(*) from public.notifications where report_id=feedback.report_id and kind='late_report')<>(select count(*) from public.profiles where role in('admin','editor') and status='active') then raise exception 'Late campus retry duplicated notifications';end if;
 if (public.submit_campus_weekly_feedback(week,a,request,campus)).id<>feedback.id then raise exception 'Admin retry duplicated campus snapshot';end if;
 begin perform public.submit_campus_weekly_feedback(week,a,request,other_campus);raise exception 'Campus target changed on retry';exception when insufficient_privilege then null;end;
 r:=public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',request,week,cluster);
 if not r.is_late or not exists(select 1 from public.notifications where cluster_report_id=r.id and recipient_id=admin_id and title='Late cluster report submitted') then raise exception 'Admin cluster late notification missing';end if;
 if exists(select 1 from public.notifications where cluster_report_id=r.id and recipient_id=editor_id) then raise exception 'Cluster report disclosed to editor';end if;
 if r.cluster_id<>cluster or r.submitted_by<>admin_id or r.submitter_name<>'Actual Administrator' then raise exception 'Admin cluster submission impersonated lead';end if;
 if (public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',request,week,cluster)).id<>r.id then raise exception 'Admin cluster retry duplicated';end if;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',request,week,other_cluster);raise exception 'Cluster target changed on retry';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',campus_lead::text,true);
 begin perform public.submit_campus_weekly_feedback(week,a,gen_random_uuid(),other_campus);raise exception 'Campus lead targeted other campus';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',cluster_lead::text,true);
 r:=public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid(),week);
 if not r.is_late or r.submitted_by<>cluster_lead or not exists(select 1 from public.notifications where cluster_report_id=r.id and recipient_id=admin_id and title='Late cluster report submitted') then raise exception 'Cluster lead late submission alert missing';end if;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid(),week,other_cluster);raise exception 'Cluster lead targeted other cluster';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',editor_id::text,true);
 begin perform public.submit_campus_weekly_feedback(week,a,gen_random_uuid(),campus);raise exception 'Editor full campus template allowed';exception when insufficient_privilege then null;end;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid(),week,cluster);raise exception 'Editor cluster template allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin perform public.submit_campus_weekly_feedback(week,jsonb_set(a,'{attendanceExcludingLead}','-1'),gen_random_uuid(),campus);raise exception 'Admin bypassed campus validation';exception when sqlstate '22023' then null;end;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["prayer"],"prayer":"yes"}',gen_random_uuid(),week,cluster);raise exception 'Admin bypassed required cluster answers';exception when sqlstate '22023' then null;end;
 begin perform public.submit_campus_weekly_feedback((select end_date+7 from public.seasons where is_current),a,gen_random_uuid(),campus);raise exception 'Admin submitted out-of-season future campus week';exception when sqlstate '22023' then null;end;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid(),(select end_date+7 from public.seasons where is_current),cluster);raise exception 'Admin submitted out-of-season future cluster week';exception when sqlstate '22023' then null;end;
 begin perform public.submit_campus_weekly_feedback(week,jsonb_set(a,'{lateReason}','""'),gen_random_uuid(),campus);raise exception 'Admin skipped required late reason';exception when sqlstate '22023' then null;end;
 if has_function_privilege('anon','public.submit_campus_weekly_feedback(date,jsonb,uuid,uuid)','execute') or has_function_privilege('anon','public.submit_cluster_report(jsonb,uuid,date,uuid)','execute') or has_function_privilege('authenticated','private.submit_cluster_report_unperioded(jsonb,uuid,uuid)','execute') then raise exception 'Template function grants widened';end if;
 update public.campuses set is_active=false where id=other_campus;
 begin perform public.submit_campus_weekly_feedback(week,a,gen_random_uuid(),other_campus);raise exception 'Admin inactive campus allowed';exception when insufficient_privilege then null;end;
 update public.clusters set is_active=false where id=other_cluster;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid(),week,other_cluster);raise exception 'Admin inactive cluster allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
