-- Removed accounts retain their records but gain no replacement authority.
-- Explicit administrator assignment/promotion is a separate reviewed operation.
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.profiles'::regclass and contype='c' and pg_get_constraintdef(oid) like '%role%campus%campus_id IS NOT NULL%' loop execute format('alter table public.profiles drop constraint %I',c.conname);end loop;
end $$;
update public.profiles set role='campus',status='pending',campus_id=null,cluster_id=null where role='editor';
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','campus','cluster'));
alter table public.profiles add constraint active_campus_scope check(role<>'campus' or status<>'active' or campus_id is not null);
-- Rewrite effective policy expressions, preserving their roles, operations and scopes.
do $$ declare p record; q text; w text;begin
 for p in select * from pg_policies where schemaname in('public','storage') and (coalesce(qual,'')||coalesce(with_check,'')) like '%editor%' loop
  q:=replace(p.qual,'''editor''','''admin''');w:=replace(p.with_check,'''editor''','''admin''');
  execute format('alter policy %I on %I.%I%s%s',p.policyname,p.schemaname,p.tablename,case when q is null then '' else ' using ('||q||')' end,case when w is null then '' else ' with check ('||w||')' end);
 end loop;
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
  if v_role not in ('admin', 'campus','cluster') then raise exception 'Invalid role.' using errcode = '22023'; end if;
  if v_status not in ('pending', 'active', 'rejected') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if v_role = 'campus' and ((v_status='active' and v_campus is null) or (v_campus is not null and not exists (select 1 from public.campuses where id = v_campus))) then
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

create or replace function private.can_access_campus(p_campus_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active'
 and (p.role in ('admin') or (p.role = 'campus' and p.campus_id = p_campus_id)
 or (p.role = 'cluster' and exists(select 1 from public.campuses c where c.id = p_campus_id and c.cluster_id = p.cluster_id))))
$$;

create or replace function private.notify_late_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_late then
 insert into public.notifications(recipient_id,kind,title,message,campus_id,report_id)
 select p.id,'late_report','Weekly report submitted late',c.name||' submitted the report for '||new.week_ending||' after Friday 10pm (Europe/London).',new.campus_id,new.id
 from public.profiles p cross join public.campuses c where p.status='active' and p.role in ('admin') and c.id=new.campus_id;
 end if; return new;
end $$;

create or replace function public.submit_grade(p_campus_id uuid,p_student_name text,p_course text,p_assessment text,p_percentage numeric,p_assessment_date date,p_notes text default '')
returns public.grades language plpgsql security definer set search_path='' as $$
declare g public.grades; begin
 if not private.can_access_campus(p_campus_id) or (select private.my_role())='cluster' then
 raise exception 'You can only submit grades for your own university.' using errcode='42501'; end if;
 if p_percentage is null or p_percentage<0 or p_percentage>100 or p_percentage <> round(p_percentage,2) then raise exception 'Grade must be between 0 and 100 with at most two decimal places.' using errcode='22023'; end if;
 insert into public.grades(campus_id,student_name,course,assessment,percentage,assessment_date,notes,submitted_by)
 values(p_campus_id,trim(p_student_name),trim(p_course),trim(p_assessment),p_percentage,p_assessment_date,coalesce(trim(p_notes),''),auth.uid()) returning * into g;
 if g.percentage<59 then
 insert into public.notifications(recipient_id,kind,title,message,campus_id,grade_id)
 select p.id,'low_grade','Grade requires follow-up',g.student_name||' received '||g.percentage||'% in '||g.assessment||'. Please review and acknowledge.',g.campus_id,g.id
 from public.profiles p join public.campuses c on c.id=g.campus_id
 where p.status='active' and (p.role in ('admin') or (p.role='cluster' and p.cluster_id=c.cluster_id));
 end if; return g;
end $$;

create or replace function public.register_material_page(p_material_id uuid,p_page_number integer,p_object_path text,p_width integer,p_height integer)
returns void language plpgsql security definer set search_path='' as $$
declare m public.materials; begin
 if auth.uid() is null or (select private.my_role()) not in ('admin') or (select private.my_role()) is null then raise exception 'Publisher required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id for update;
 if m.id is null or not m.is_active or m.protected_ready then raise exception 'Material unavailable for preparation.' using errcode='42501'; end if;
 if p_page_number is null or p_page_number not between 1 and 100 or p_width is null or p_width not between 1 and 1600 or p_height is null or p_height not between 1 and 2400 or p_object_path is distinct from auth.uid()::text||'/'||p_material_id::text||'/page-'||p_page_number::text||'.png' then raise exception 'Invalid protected page.' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='koc-material-pages' and name=p_object_path) then raise exception 'Upload page before registering.' using errcode='22023'; end if;
 insert into public.material_pages(material_id,page_number,object_path,width,height) values(p_material_id,p_page_number,p_object_path,p_width,p_height)
 on conflict(material_id,page_number) do nothing;
 if not exists(select 1 from public.material_pages where material_id=p_material_id and page_number=p_page_number and object_path=p_object_path and width=p_width and height=p_height) then raise exception 'Page already registered with different content.' using errcode='22023'; end if;
end $$;

create or replace function public.finalize_material(p_material_id uuid,p_page_count integer) returns void language plpgsql security definer set search_path='' as $$
declare m public.materials; begin
 if auth.uid() is null or (select private.my_role()) not in ('admin') or (select private.my_role()) is null then raise exception 'Publisher required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id for update;
 if m.id is null or not m.is_active or m.protected_ready then raise exception 'Material unavailable for preparation.' using errcode='42501'; end if;
 if p_page_count is null or p_page_count not between 1 and 100 or (select count(*) from public.material_pages where material_id=p_material_id)<>p_page_count or exists(select 1 from generate_series(1,p_page_count) n where not exists(select 1 from public.material_pages p join storage.objects o on o.bucket_id='koc-material-pages' and o.name=p.object_path where p.material_id=p_material_id and p.page_number=n)) then raise exception 'Complete contiguous uploaded pages required.' using errcode='22023'; end if;
 update public.materials set page_count=p_page_count,protected_ready=true where id=p_material_id;
end $$;

create or replace function public.protected_material_page_access(p_material_id uuid,p_page_number integer,p_session_id uuid default null)
returns table(session_id uuid,object_path text,watermark_identity text,page_count integer)
language plpgsql security definer set search_path='' as $$
declare u public.profiles; m public.materials; s private.material_reader_sessions; page public.material_pages; begin
 -- Serialize requests per reader so concurrent clients cannot evade session/rate limits.
 select * into u from public.profiles where id=auth.uid() for update;
 if u.id is null or u.status<>'active' then raise exception 'Active account required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id;
 if m.id is null or not m.is_active or not m.protected_ready or (u.role not in ('admin') and m.campus_id is not null and not private.can_access_campus(m.campus_id)) then raise exception 'Material access denied.' using errcode='42501'; end if;
 select * into page from public.material_pages where material_id=m.id and page_number=p_page_number;
 if page.material_id is null then raise exception 'Page unavailable.' using errcode='22023'; end if;
 if (select count(*) from private.material_page_audit a where a.user_id=u.id and a.created_at>now()-interval '1 minute')>=60 then raise exception 'Reader rate limit exceeded.' using errcode='P0001'; end if;
 if p_session_id is not null then
 select * into s from private.material_reader_sessions where id=p_session_id and user_id=u.id and material_id=m.id and expires_at>now();
 if s.id is null then raise exception 'Reader session expired or invalid.' using errcode='42501'; end if;
 else
 select * into s from private.material_reader_sessions where user_id=u.id and material_id=m.id and expires_at>now() order by created_at desc limit 1;
 if s.id is null then
 if (select count(*) from private.material_reader_sessions where user_id=u.id and created_at>now()-interval '1 hour')>=20 then raise exception 'Reader session rate limit exceeded.' using errcode='P0001'; end if;
 insert into private.material_reader_sessions(user_id,material_id) values(u.id,m.id) returning * into s;
 end if;
 end if;
 insert into private.material_page_audit(session_id,user_id,material_id,page_number) values(s.id,u.id,m.id,p_page_number);
 return query select s.id,page.object_path,coalesce(nullif(u.full_name,''),'KOC reader')||' | '||u.id::text,m.page_count;
end $$;

create or replace function public.persist_lead_application(p_user_id uuid,p_answers jsonb,p_request_id uuid) returns public.lead_applications language plpgsql security definer set search_path='' as $$
declare saved public.lead_applications; me public.profiles; campus uuid; university text:=p_answers->>'newUniversityName';
begin
 if p_request_id is null then raise exception 'Application request required.' using errcode='22023';end if;
 perform private.validate_lead_application(p_answers);
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('lead-application-'||p_request_id::text,0));
 select * into saved from public.lead_applications where request_id=p_request_id;
 if saved.id is not null then if saved.answers is distinct from p_answers then raise exception 'This request already contains another application.' using errcode='22023';end if;return saved;end if;
 select * into me from public.profiles where id=p_user_id for update;
 if me.id is null or me.status<>'pending' or me.role<>'campus' or me.campus_id is not null or me.username is not null or me.email !~ '^[a-f0-9-]{36}@accounts\.kocm\.invalid$' or me.full_name is distinct from p_answers->>'fullName' then raise exception 'Invalid pending applicant.' using errcode='42501';end if;
 if p_answers->>'kind'='existing' then campus:=(p_answers->>'campusId')::uuid;if not exists(select 1 from public.campuses where id=campus) then raise exception 'Campus not found.' using errcode='22023';end if;
 else
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended('new-campus-'||lower(university),0));
  select id into campus from public.campuses where lower(trim(name))=lower(university) order by created_at limit 1;
  if campus is null then insert into public.campuses(name,region,is_active,lifecycle_status) values(university,'Unassigned',false,'in_process') returning id into campus;end if;
 end if;
 update public.profiles set role='campus',campus_id=campus,username=p_answers->>'username',course=p_answers->>'course',study_year=(p_answers->>'studyYear')::int,phone=nullif(p_answers->>'phone','') where id=p_user_id;
 insert into public.lead_applications(user_id,campus_id,kind,answers,request_id) values(p_user_id,campus,p_answers->>'kind',p_answers,p_request_id) returning * into saved;
 insert into public.notifications(recipient_id,kind,title,message,campus_id,application_id)
 select id,'lead_application','New campus lead application',me.full_name||' has submitted a campus lead application for '||(select name from public.campuses where id=campus)||'. Review the application before approving access.',campus,saved.id from public.profiles where role='admin' and status='active';
 return saved;
end $$;

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare v_role text:=new.raw_app_meta_data->>'koc_role';v_name text:=coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1));v_campus uuid;v_status text;
begin
 if v_role='admin' then v_status:='active';
 else
  begin v_campus:=(new.raw_user_meta_data->>'campus_id')::uuid;exception when others then v_campus:=null;end;
  if v_campus is not null and not exists(select 1 from public.campuses where id=v_campus and is_active) then raise exception 'Select an active university.';end if;
  v_role:='campus';v_status:='pending';
 end if;
 insert into public.profiles(id,full_name,email,role,status,campus_id) values(new.id,left(v_name,100),lower(new.email),v_role,v_status,v_campus);return new;
end $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
