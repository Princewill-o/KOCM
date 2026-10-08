begin;
insert into auth.users(id,email,raw_app_meta_data) values ('90000000-0000-0000-0000-000000000002','cluster-admin@example.test','{"koc_role":"admin"}');
insert into auth.users(id,email,raw_app_meta_data) values ('90000000-0000-0000-0000-000000000001','cluster-report@example.test','{}');
update public.profiles set role='cluster',status='active',cluster_id=(select id from public.clusters where name='London') where id='90000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
declare body jsonb:='{"scope":"cluster","areas":["session"],"session":"no","session.lesson":"hidden","evil":"drop"}'; a public.cluster_reports; b public.cluster_reports;
begin
 a:=public.submit_cluster_report(body,'91000000-0000-0000-0000-000000000001');
 b:=public.submit_cluster_report(body,'91000000-0000-0000-0000-000000000001');
 if a.id<>b.id or a.answers ? 'session.lesson' or a.answers ? 'evil' then raise exception 'Idempotence/sanitization failed'; end if;
 b:=public.submit_cluster_report('{"scope":"cluster","areas":["prayer"],"prayer":"yes","prayer.date":"2026-10-07","prayer.duration":"30.5","prayer.attendees":"3","prayer.intensity":"no","prayer.intensity.description":"hidden","prayer.resistance":"no","prayer.topics":"no"}','91000000-0000-0000-0000-000000000006');
 if b.answers ? 'prayer.intensity.description' then raise exception 'Hidden explanation retained'; end if;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["prayer"],"prayer":"yes","prayer.date":"2026-10-07","prayer.duration":"30","prayer.attendees":"3","prayer.intensity":"yes","prayer.resistance":"no","prayer.topics":"no"}',gen_random_uuid()); raise exception 'Conditional required explanation omitted'; exception when invalid_parameter_value then null; end;

 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["prayer"],"prayer":"yes"}','91000000-0000-0000-0000-000000000002'); raise exception 'Missing required answers accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["core"],"core":"yes","core.members":"-1"}','91000000-0000-0000-0000-000000000003'); raise exception 'Negative count accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["core"],"core":"yes","core.members":"1.5"}','91000000-0000-0000-0000-000000000004'); raise exception 'Decimal count accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_cluster_report(jsonb_build_object('scope','campus','campusId',(select id from public.campuses where name='Aston'),'areas',jsonb_build_array('session')),'91000000-0000-0000-0000-000000000005'); raise exception 'Foreign campus accepted'; exception when insufficient_privilege then null; end;
 begin perform public.submit_cluster_report(body||jsonb_build_object('session','yes'),'91000000-0000-0000-0000-000000000001'); raise exception 'Changed retry accepted'; exception when invalid_parameter_value then null; end;
 begin insert into public.cluster_reports(request_id,cluster_id,scope,answers,submitted_by) values(gen_random_uuid(),a.cluster_id,'cluster',body,auth.uid()); raise exception 'Direct insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.cluster_reports)<>2 then raise exception 'Admin missing submitted report'; end if;
 if (select count(*) from public.notifications where kind='cluster_report')<>2 then raise exception 'Admin alert missing or retry duplicated'; end if;
 if not exists(select 1 from public.cluster_reports where submitter_name is not null and submitter_email='cluster-report@example.test') then raise exception 'Server submitter snapshot missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
update public.profiles set cluster_id=(select id from public.clusters where name='North') where id='90000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin if (select count(*) from public.cluster_reports)<>0 then raise exception 'Other cluster reports visible'; end if; begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}','91000000-0000-0000-0000-000000000001'); raise exception 'Previous cluster report returned'; exception when insufficient_privilege then null; end; end $$;
reset role;
update public.profiles set status='pending' where id='90000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
 if (select count(*) from public.cluster_reports)<>0 then raise exception 'Pending account reads reports'; end if;
 begin perform public.submit_cluster_report('{"scope":"cluster","areas":["session"],"session":"no"}',gen_random_uuid()); raise exception 'Pending account submitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
