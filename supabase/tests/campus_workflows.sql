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
 begin perform public.submit_report('2026-09-18',10,30,20,1,'',(select id from public.campuses where name='Aston')); raise exception 'Cross-cluster report write allowed'; exception when insufficient_privilege then null; end;
 begin perform public.acknowledge_notification((select id from public.notifications where recipient_id='10000000-0000-0000-0000-000000000001' limit 1)); raise exception 'Acknowledged other notification'; exception when insufficient_privilege then null; end;
end $$;
select public.submit_report('2026-09-25',13,30,20,1,'Cluster submission',(select id from public.campuses where name='Brunel'));
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
-- Protected materials: originals are never readable by campus users, even assigned ones.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
insert into public.materials(id,title,object_path,campus_id) values('30000000-0000-0000-0000-000000000001','Protected material','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001.pdf',(select id from public.campuses where name='Brunel'));
insert into storage.objects(bucket_id,name) values('koc-materials','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001.pdf');
insert into storage.objects(bucket_id,name) values('koc-material-pages','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/page-1.png');
select public.register_material_page('30000000-0000-0000-0000-000000000001',1,'10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/page-1.png',1200,1800);
do $$ begin
 begin perform public.finalize_material('30000000-0000-0000-0000-000000000001',2); raise exception 'Incomplete material published'; exception when invalid_parameter_value then null; end;
 begin perform public.register_material_page('30000000-0000-0000-0000-000000000001',2,'bad-path',1200,1800); raise exception 'Bad path registered'; exception when invalid_parameter_value then null; end;
end $$;
select public.finalize_material('30000000-0000-0000-0000-000000000001',1);
do $$ begin
 begin perform public.register_material_page('30000000-0000-0000-0000-000000000001',2,'10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/page-2.png',1200,1800); raise exception 'Published material modified'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from storage.objects),'assigned campus cannot read raw PDF or raw PNG');
select pg_temp.assert_true((select count(*)=0 from public.material_pages),'campus cannot inspect raw page metadata');
select pg_temp.assert_true((select page_count=1 and watermark_identity like '%10000000-0000-0000-0000-000000000003' from public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1)),'authorized stamped page access contract');
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1,'40000000-0000-0000-0000-000000000001'); raise exception 'Forged reader session accepted'; exception when insufficient_privilege then null; end;
 begin perform public.finalize_material('30000000-0000-0000-0000-000000000001',1); raise exception 'Campus finalized material'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_true((select count(*)=1 from private.material_reader_sessions),'one reader session created');
select set_config('test.reader_session',(select id::text from private.material_reader_sessions),true);
-- A valid session token still cannot be borrowed by another authorized reader.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1,current_setting('test.reader_session')::uuid); raise exception 'Other reader session borrowed'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert_true((select page_count=1 from public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1)),'cluster lead reads assigned campus');
reset role;
update public.profiles set cluster_id=(select id from public.clusters where name='Midlands') where id='10000000-0000-0000-0000-000000000004';
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1); raise exception 'Reassigned cluster retained material'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set cluster_id=(select id from public.clusters where name='London') where id='10000000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
update public.profiles set campus_id=(select id from public.campuses where name='Aston') where id='10000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1,current_setting('test.reader_session')::uuid); raise exception 'Reassigned campus retained material'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set campus_id=(select id from public.campuses where name='Brunel') where id='10000000-0000-0000-0000-000000000003';
update private.material_reader_sessions set expires_at=now()-interval '1 second' where id=current_setting('test.reader_session')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1,current_setting('test.reader_session')::uuid); raise exception 'Expired session accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Fill the hourly allowance with actual expired session records; a null token cannot bypass it.
insert into private.material_reader_sessions(user_id,material_id,expires_at)
select '10000000-0000-0000-0000-000000000003'::uuid,'30000000-0000-0000-0000-000000000001'::uuid,now()-interval '1 second' from generate_series(1,19);
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1); raise exception 'Hourly session allowance bypassed'; exception when raise_exception then if sqlerrm <> 'Reader session rate limit exceeded.' then raise; end if; end;
end $$;
reset role;
-- Restore a readable session for the independent page-rate check below.
update private.material_reader_sessions set expires_at=now()+interval '15 minutes' where id=current_setting('test.reader_session')::uuid;

insert into private.material_page_audit(session_id,user_id,material_id,page_number)
select id,user_id,material_id,1 from private.material_reader_sessions cross join generate_series(1,59) where id=current_setting('test.reader_session')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1); raise exception 'Page rate limit bypassed'; exception when raise_exception then if sqlerrm <> 'Reader rate limit exceeded.' then raise; end if; end;
end $$;
reset role;

update public.profiles set status='rejected' where id='10000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1); raise exception 'Revoked reader retained access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Execute grants are independent of JWT claims: anonymous callers cannot invoke RPCs.
set local role anon;
do $$ begin
 begin perform public.protected_material_page_access('30000000-0000-0000-0000-000000000001',1); raise exception 'Anonymous protected RPC allowed'; exception when insufficient_privilege then null; end;
 begin perform public.finalize_material('30000000-0000-0000-0000-000000000001',1); raise exception 'Anonymous finalize RPC allowed'; exception when insufficient_privilege then null; end;
 begin perform public.register_material_page('30000000-0000-0000-0000-000000000001',1,'fake',1,1); raise exception 'Anonymous register RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 begin insert into public.materials(title,object_path,protected_ready,page_count) values('Forged protected','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000002.pdf',true,1); raise exception 'Publisher forged protected readiness'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Storage API grants UPDATE in Supabase; add that grant to the local stub to test RLS itself.
grant update on storage.objects to authenticated;
set local role authenticated;
do $$ declare affected integer; begin
 update storage.objects set name=name where bucket_id='koc-material-pages' and name='10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/page-1.png';
 get diagnostics affected = row_count;
 perform pg_temp.assert_true(affected=0,'published page retry cannot overwrite object');
end $$;
insert into public.materials(id,title,object_path) values('30000000-0000-0000-0000-000000000002','Unpublished material','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000002.pdf');
insert into storage.objects(bucket_id,name) values('koc-material-pages','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000002/page-1.png');
do $$ declare affected integer; begin
 update storage.objects set name=name where bucket_id='koc-material-pages' and name='10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000002/page-1.png';
 get diagnostics affected = row_count;
 perform pg_temp.assert_true(affected=1,'unpublished publisher page permits retry');
end $$;
reset role;
rollback;
