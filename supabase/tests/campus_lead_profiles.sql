begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
insert into auth.users(id,email,raw_app_meta_data) values
('91000000-0000-0000-0000-000000000001','lead-owner@example.test','{"koc_role":"admin"}'),
('91000000-0000-0000-0000-000000000002','lead-one@example.test','{}'),
('91000000-0000-0000-0000-000000000003','lead-two@example.test','{}');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.admin_update_user('91000000-0000-0000-0000-000000000002',p_role=>'campus',p_status=>'active',p_campus_id=>(select id from public.campuses order by name limit 1));
select public.admin_update_user('91000000-0000-0000-0000-000000000003',p_role=>'campus',p_status=>'pending',p_campus_id=>(select id from public.campuses order by name limit 1));
do $$ begin
 begin perform public.admin_update_user('91000000-0000-0000-0000-000000000003',p_status=>'active');raise exception 'Duplicate approval allowed';exception when unique_violation then null;end;
end $$;
select public.admin_update_user('91000000-0000-0000-0000-000000000003',p_status=>'active',p_campus_id=>(select id from public.campuses order by name offset 1 limit 1));
do $$ begin
 begin perform public.admin_update_user('91000000-0000-0000-0000-000000000003',p_campus_id=>(select id from public.campuses order by name limit 1));raise exception 'Duplicate reassignment allowed';exception when unique_violation then null;end;
end $$;
select pg_temp.assert_true((select count(*)=2 from public.campus_lead_profiles() where lead_id is not null),'two independently assigned leaders');
select pg_temp.assert_true((select count(*)=(select count(*) from public.campuses where is_active) from public.campus_lead_profiles()),'unassigned campuses retained');
reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select public.update_my_profile('Campus Leader','+44 7700 900123','Computer Science',2,'Fellowship lead.');
select pg_temp.assert_true((select full_name='Campus Leader' and phone='+44 7700 900123' and course='Computer Science' and study_year=2 and bio='Fellowship lead.' and role='campus' and status='active' from public.profiles where id=auth.uid()),'self details changed without authority change');
do $$ begin
 begin perform public.update_my_profile('Campus Leader','not a phone','Course',2,'');raise exception 'Bad phone accepted';exception when invalid_parameter_value then null;end;
 begin perform public.update_my_profile('Campus Leader','','Course',0,'');raise exception 'Bad year accepted';exception when invalid_parameter_value then null;end;
 begin perform public.update_my_profile('Campus Leader','',repeat('x',121),2,'');raise exception 'Long course accepted';exception when invalid_parameter_value then null;end;
 begin perform public.update_my_profile('Campus Leader','','',2,repeat('x',1001));raise exception 'Long bio accepted';exception when invalid_parameter_value then null;end;
 begin perform public.campus_lead_profiles();raise exception 'Leader accessed admin map profiles';exception when insufficient_privilege then null;end;
 begin update public.profiles set phone='123456789' where id='91000000-0000-0000-0000-000000000003';raise exception 'Direct profile detail write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.profiles set role='campus',status='pending',campus_id=null where id='91000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.campus_lead_profiles();raise exception 'Pending unassigned accessed leader contacts';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.assert_true((select phone is null from public.profiles where id='91000000-0000-0000-0000-000000000003'),'other person unchanged');
-- A historical report belongs to campus, never to a reassigned account.
insert into public.reports(campus_id,season_id,week_ending,attendance,prayer_minutes,evangelism_minutes,outreach_outings,submitted_by,updated_by)
select campus_id,(select id from public.seasons where is_current),date '2026-09-18',7,30,20,1,id,id from public.profiles where id='91000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.admin_update_user('91000000-0000-0000-0000-000000000002',p_campus_id=>(select id from public.campuses order by name offset 2 limit 1));
reset role;
select pg_temp.assert_true((select campus_id=(select id from public.campuses order by name limit 1) and attendance=7 from public.reports where submitted_by='91000000-0000-0000-0000-000000000002'),'reassignment retains campus statistics');
set local role anon;
do $$ begin
 begin perform public.campus_lead_profiles();raise exception 'Anonymous map profile access';exception when insufficient_privilege then null;end;
 begin perform public.update_my_profile('Anon','','',null,'');raise exception 'Anonymous self edit';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
