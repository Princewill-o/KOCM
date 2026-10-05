-- Run against a disposable Supabase-compatible database after migrations. All fixtures roll back.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
insert into auth.users(id,email,raw_app_meta_data) values
 ('10000000-0000-0000-0000-000000000001','admin@example.test','{"koc_role":"admin"}'),
 ('10000000-0000-0000-0000-000000000002','editor@example.test','{"koc_role":"editor"}'),
 ('10000000-0000-0000-0000-000000000003','campus@example.test','{}'),
 ('10000000-0000-0000-0000-000000000004','cluster@example.test','{}');
update public.profiles set role='campus',status='active',campus_id=(select id from public.campuses where name='Brunel') where id='10000000-0000-0000-0000-000000000003';
update public.profiles set role='cluster',status='active',cluster_id=(select id from public.clusters where name='London') where id='10000000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.assert_true(private.can_access_campus((select id from public.campuses where name='Brunel')),'campus reads own');
select pg_temp.assert_true(not private.can_access_campus((select id from public.campuses where name='Aston')),'campus cannot read other');
select public.submit_grade((select id from public.campuses where name='Brunel'),'Test Student','Course','Essay',58.99,'2026-10-01','');
select public.submit_grade((select id from public.campuses where name='Brunel'),'Test Student','Course','Exam',59,'2026-10-01','');
do $$ begin
 begin perform public.submit_grade((select id from public.campuses where name='Brunel'),'Test Student','Course','Essay',58.999,current_date,''); raise exception 'Invalid precision allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_grade((select id from public.campuses where name='Aston'),'Test Student','Course','Essay',40,current_date,''); raise exception 'Cross-campus grade allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.contacts(campus_id,full_name,phone) values((select id from public.campuses where name='Aston'),'Test Contact','07123456789'); raise exception 'Cross-campus contact allowed'; exception when insufficient_privilege then null; end;
end $$;
insert into public.contacts(campus_id,full_name,phone) values((select id from public.campuses where name='Brunel'),'Test Contact','07123456789');
select public.submit_report('2026-09-18',10,30,20,1,'',null);
select public.submit_report('2026-09-18',11,30,20,1,'edited',null);
reset role;
select pg_temp.assert_true((select count(*)=3 from public.notifications where kind='low_grade'),'58.99 alerts two overall leads and own cluster, 59 no alert');
select pg_temp.assert_true((select count(*)=2 from public.notifications where kind='late_report'),'late insert alerts leads once; edits no duplicate');
select pg_temp.assert_true(public.report_deadline('2026-10-23','2026-2027')='2026-10-23 21:00+00'::timestamptz,'BST deadline');
select pg_temp.assert_true(public.report_deadline('2026-10-30','2026-2027')='2026-10-30 22:00+00'::timestamptz,'GMT deadline');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=2 from public.grades),'cluster sees own grades');
select pg_temp.assert_true(not private.can_access_campus((select id from public.campuses where name='Aston')),'cluster cannot read other cluster');
do $$ begin
 begin perform public.submit_report('2026-09-18',10,30,20,1,'',(select id from public.campuses where name='Brunel')); raise exception 'Cluster report write allowed'; exception when insufficient_privilege then null; end;
 begin perform public.acknowledge_notification((select id from public.notifications where recipient_id='10000000-0000-0000-0000-000000000001' limit 1)); raise exception 'Acknowledged other notification'; exception when insufficient_privilege then null; end;
end $$;
select public.acknowledge_notification((select id from public.notifications limit 1));
select pg_temp.assert_true((select bool_and(read_at is not null) from public.notifications),'read acknowledgement persisted');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
insert into public.materials(title,object_path,campus_id) values('Restricted PDF','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.pdf',(select id from public.campuses where name='Aston'));
insert into storage.objects(bucket_id,name) values('koc-materials','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.pdf');
insert into storage.objects(bucket_id,name) values('koc-materials','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002.pdf');
delete from storage.objects where name='10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002.pdf';
select pg_temp.assert_true((select count(*)=0 from storage.objects where name like '%000002.pdf'),'uploader removes orphan file');
delete from storage.objects where name='10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.pdf';
select pg_temp.assert_true((select count(*)=1 from storage.objects),'published material file cannot be deleted');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.materials),'campus cannot read other-campus materials');
select pg_temp.assert_true((select count(*)=0 from storage.objects),'campus cannot read other-campus file');
do $$ begin
 begin insert into public.materials(title,object_path) values('Unauthorized','10000000-0000-0000-0000-000000000003/20000000-0000-0000-0000-000000000002.pdf'); raise exception 'Campus material upload allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.grades; raise exception 'Anonymous grades allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
