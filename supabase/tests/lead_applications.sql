begin;
do $$
declare me uuid:=gen_random_uuid(); duplicate_user uuid:=gen_random_uuid(); admin_user uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); a jsonb; saved public.lead_applications; campus public.campuses; existingcampus uuid;
begin
 if has_function_privilege('anon','public.persist_lead_application(uuid,jsonb,uuid)','execute') or has_function_privilege('authenticated','public.lead_application_completed(uuid,jsonb)','execute') then raise exception 'Service-only application endpoint exposed';end if;
 select id into existingcampus from public.campuses limit 1;
 insert into auth.users(id,email,raw_user_meta_data) values(me,me::text||'@accounts.kocm.invalid',jsonb_build_object('full_name','New Lead')),(duplicate_user,duplicate_user::text||'@accounts.kocm.invalid',jsonb_build_object('full_name','New Lead'));
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(admin_user,'application-admin@example.org','{"koc_role":"admin"}', '{"full_name":"Application Admin"}');
 a:=jsonb_build_object('username','application_lead','fullName','New Lead','kind','new','campusId',null,'newUniversityName','Application Test University','newUniversityCity','London','course','Physics','studyYear',2,'motivation','Support students through fellowship.','experience','Served on a fellowship prayer team.','availability','Tuesday evenings','plan','Start with prayer and invite students.','phone','');
 saved:=public.persist_lead_application(me,a,request);
 select * into campus from public.campuses where id=saved.campus_id;
 if campus.is_active or campus.lifecycle_status<>'in_process' or campus.region<>'Unassigned' then raise exception 'New university incorrectly activated';end if;
 if (select role<>'campus' or status<>'pending' or username<>'application_lead' from public.profiles where id=me) then raise exception 'Applicant incorrectly approved or linked';end if;
 if not exists(select 1 from public.notifications where recipient_id=admin_user and application_id=saved.id and kind='lead_application') then raise exception 'Administrator not notified';end if;
 if not public.lead_application_completed(request,a) or (public.persist_lead_application(duplicate_user,a,request)).id<>saved.id then raise exception 'Idempotent retry failed';end if;
 begin perform public.persist_lead_application(duplicate_user,jsonb_set(a,'{motivation}','"Changed detailed motivation text"'),request);raise exception 'Changed retry accepted';exception when sqlstate '22023' then null;end;
 begin perform public.persist_lead_application(duplicate_user,a||'{"password":"never-store"}',gen_random_uuid());raise exception 'Password accepted';exception when sqlstate '22023' then null;end;
 update public.campuses set is_active=false where id=existingcampus;
 a:=a||jsonb_build_object('username','application_other','kind','existing','campusId',existingcampus,'newUniversityName','','newUniversityCity','');
 saved:=public.persist_lead_application(duplicate_user,a,gen_random_uuid());if saved.campus_id<>existingcampus then raise exception 'Inactive campus selection failed';end if;
 perform set_config('request.jwt.claim.sub',me::text,true);
end $$;
set local role authenticated;
do $$ begin if (select count(*) from public.lead_applications)<>1 then raise exception 'Pending applicant must see only own application';end if;end $$;
reset role;
set local role anon;
do $$ begin
 if not exists(select 1 from public.list_application_campuses() where name='Application Test University' and lifecycle_status='in_process') then raise exception 'Public campus selector failed';end if;
 begin perform * from public.lead_applications;raise exception 'Anonymous detailed application read';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
