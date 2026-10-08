create table public.lead_applications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),campus_id uuid not null references public.campuses(id),kind text not null check(kind in ('existing','new')),answers jsonb not null,request_id uuid not null unique,created_at timestamptz not null default now(),unique(user_id));
create index lead_applications_created on public.lead_applications(created_at desc);
alter table public.lead_applications enable row level security;
revoke all on public.lead_applications from public,anon,authenticated;
grant select on public.lead_applications to authenticated;
create policy "Own or administrator applications" on public.lead_applications for select to authenticated using(user_id=auth.uid() or (select private.my_role())='admin');
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('late_report','low_grade','cluster_report','lead_application'));
alter table public.notifications add column application_id uuid references public.lead_applications(id);
create unique index notifications_application_unique on public.notifications(recipient_id,application_id) where application_id is not null;
create function public.list_application_campuses() returns table(id uuid,name text,lifecycle_status text) language sql stable security definer set search_path='' as $$select c.id,c.name::text,c.lifecycle_status from public.campuses c order by c.name$$;
revoke all on function public.list_application_campuses() from public;grant execute on function public.list_application_campuses() to anon,authenticated;
create function private.validate_lead_application(a jsonb) returns void language plpgsql set search_path='' as $$
declare k text; v text; n numeric;
begin
 if a is null or jsonb_typeof(a)<>'object' or pg_column_size(a)>18000 or exists(select 1 from jsonb_object_keys(a) key where key not in ('username','fullName','kind','campusId','newUniversityName','newUniversityCity','course','studyYear','motivation','experience','availability','plan','phone')) then raise exception 'Invalid application fields.' using errcode='22023';end if;
 foreach k in array array['username','fullName','kind','newUniversityName','newUniversityCity','course','motivation','experience','availability','plan','phone'] loop
  if jsonb_typeof(a->k) is distinct from 'string' then raise exception 'Invalid field %.',k using errcode='22023';end if;
  v:=a->>k;if v is distinct from trim(v) or char_length(v)>(case when k='username' then 30 when k in ('fullName','newUniversityCity') then 100 when k='newUniversityName' then 160 when k='course' then 120 when k='availability' then 1000 when k='phone' then 40 else 3000 end) then raise exception 'Invalid field %.',k using errcode='22023';end if;
 end loop;
 if a->>'username' !~ '^[a-z0-9_]{3,30}$' or char_length(a->>'fullName')<2 or char_length(a->>'course')<2 or a->>'kind' not in ('existing','new') then raise exception 'Invalid identity or course.' using errcode='22023';end if;
 foreach k in array array['motivation','experience','plan'] loop if char_length(a->>k)<20 then raise exception 'Explain %.',k using errcode='22023';end if;end loop;
 if char_length(a->>'availability')<5 or jsonb_typeof(a->'studyYear') is distinct from 'number' then raise exception 'Invalid availability or study year.' using errcode='22023';end if;
 n:=(a->>'studyYear')::numeric;if n<>trunc(n) or n not between 1 and 10 then raise exception 'Invalid study year.' using errcode='22023';end if;
 v:=a->>'phone';if v<>'' and (v !~ '^\+?[0-9 ()-]+$' or char_length(regexp_replace(v,'[^0-9]','','g')) not between 7 and 15) then raise exception 'Invalid phone number.' using errcode='22023';end if;
 if a->>'kind'='existing' then
  if jsonb_typeof(a->'campusId') is distinct from 'string' or a->>'campusId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or a->>'newUniversityName'<>'' or a->>'newUniversityCity'<>'' then raise exception 'Choose an existing campus.' using errcode='22023';end if;
 else
  if jsonb_typeof(a->'campusId') is distinct from 'null' or char_length(a->>'newUniversityName')<3 or char_length(a->>'newUniversityCity')<2 then raise exception 'Enter the university and city.' using errcode='22023';end if;
 end if;
end $$;
revoke all on function private.validate_lead_application(jsonb) from public,anon,authenticated;
create function public.lead_application_completed(p_request_id uuid,p_answers jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare saved public.lead_applications;
begin
 perform private.validate_lead_application(p_answers);
 if p_request_id is null then raise exception 'Request required.' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('lead-application-'||p_request_id::text,0));
 select * into saved from public.lead_applications where request_id=p_request_id;
 if saved.id is null then return false;end if;
 if saved.answers is distinct from p_answers then raise exception 'This request already contains another application.' using errcode='22023';end if;return true;
end $$;
create function public.persist_lead_application(p_user_id uuid,p_answers jsonb,p_request_id uuid) returns public.lead_applications language plpgsql security definer set search_path='' as $$
declare saved public.lead_applications; me public.profiles; campus uuid; university text:=p_answers->>'newUniversityName';
begin
 if p_request_id is null then raise exception 'Application request required.' using errcode='22023';end if;
 perform private.validate_lead_application(p_answers);
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('lead-application-'||p_request_id::text,0));
 select * into saved from public.lead_applications where request_id=p_request_id;
 if saved.id is not null then if saved.answers is distinct from p_answers then raise exception 'This request already contains another application.' using errcode='22023';end if;return saved;end if;
 select * into me from public.profiles where id=p_user_id for update;
 if me.id is null or me.status<>'pending' or me.role<>'editor' or me.campus_id is not null or me.username is not null or me.email !~ '^[a-f0-9-]{36}@accounts\.kocm\.invalid$' or me.full_name is distinct from p_answers->>'fullName' then raise exception 'Invalid pending applicant.' using errcode='42501';end if;
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
revoke all on function public.lead_application_completed(uuid,jsonb),public.persist_lead_application(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.lead_application_completed(uuid,jsonb),public.persist_lead_application(uuid,jsonb,uuid) to service_role;
