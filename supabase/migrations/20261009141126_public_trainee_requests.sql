alter table public.lead_applications alter column user_id drop not null;
alter table public.lead_applications add column photo_path text, add column photo_sha256 text, add column status text not null default 'pending' check(status in ('pending','approved','rejected')), add column reviewed_by uuid references public.profiles(id), add column reviewed_at timestamptz, add column review_reason text;
alter table public.lead_applications add constraint lead_request_photo_pair check((photo_path is null and photo_sha256 is null) or (photo_path is not null and photo_sha256 ~ '^[a-f0-9]{64}$'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('trainee-photos','trainee-photos',false,3145728,array['image/png']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/png'];
create policy "Administrators read trainee photographs" on storage.objects for select to authenticated using(bucket_id='trainee-photos' and (select private.my_role())='admin');
revoke execute on function public.persist_lead_application(uuid,jsonb,uuid), public.lead_application_completed(uuid,jsonb) from service_role;
create function private.validate_public_lead_request(a jsonb) returns void language plpgsql set search_path='' as $$
declare k text; v text; n numeric;
begin
 if a is null or jsonb_typeof(a)<>'object' or pg_column_size(a)>18000 or exists(select 1 from jsonb_object_keys(a) key where key not in ('email','fullName','kind','campusId','newUniversityName','newUniversityCity','course','studyYear','motivation','experience','availability','plan','phone')) then raise exception 'Invalid application fields.' using errcode='22023';end if;
 foreach k in array array['fullName','kind','newUniversityName','newUniversityCity','course','motivation','experience','availability','plan'] loop
  if jsonb_typeof(a->k) is distinct from 'string' then raise exception 'Invalid field %.',k using errcode='22023';end if;
  v:=a->>k;if v is distinct from trim(v) or char_length(v)>(case when k='email' then 254 when k in ('fullName','newUniversityCity') then 100 when k='newUniversityName' then 160 when k='course' then 120 when k='availability' then 1000 when k='phone' then 40 else 3000 end) then raise exception 'Invalid field %.',k using errcode='22023';end if;
 end loop;
 if char_length(a->>'fullName')<2 or char_length(a->>'course')<2 or a->>'kind' not in ('existing','new') then raise exception 'Invalid identity or course.' using errcode='22023';end if;
 foreach k in array array['motivation','experience','plan'] loop if char_length(a->>k)<20 then raise exception 'Explain %.',k using errcode='22023';end if;end loop;
 if char_length(a->>'availability')<5 or jsonb_typeof(a->'studyYear') is distinct from 'number' then raise exception 'Invalid availability or study year.' using errcode='22023';end if;
 n:=(a->>'studyYear')::numeric;if n<>trunc(n) or n not between 1 and 10 then raise exception 'Invalid study year.' using errcode='22023';end if;
 foreach k in array array['email','phone'] loop if a ? k and (jsonb_typeof(a->k) is distinct from 'string' or a->>k is distinct from trim(a->>k) or char_length(a->>k)>(case when k='email' then 254 else 40 end)) then raise exception 'Invalid optional contact.' using errcode='22023';end if;end loop;
 if coalesce(a->>'email','')<>'' and a->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email.' using errcode='22023';end if;
 v:=coalesce(a->>'phone','');if v<>'' and (v !~ '^\+?[0-9 ()-]+$' or char_length(regexp_replace(v,'[^0-9]','','g')) not between 7 and 15) then raise exception 'Invalid phone number.' using errcode='22023';end if;
 if a->>'kind'='existing' then
  if jsonb_typeof(a->'campusId') is distinct from 'string' or a->>'campusId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or a->>'newUniversityName'<>'' or a->>'newUniversityCity'<>'' then raise exception 'Choose an existing campus.' using errcode='22023';end if;
 else
  if jsonb_typeof(a->'campusId') is distinct from 'null' or char_length(a->>'newUniversityName')<3 or char_length(a->>'newUniversityCity')<2 then raise exception 'Enter the university and city.' using errcode='22023';end if;
 end if;
end $$;
revoke all on function private.validate_public_lead_request(jsonb) from public,anon,authenticated;

create function public.completed_public_lead_request(p_request_id uuid,p_answers jsonb,p_photo_sha256 text) returns uuid language plpgsql security definer set search_path='' as $$
declare saved public.lead_applications;
begin
 perform private.validate_public_lead_request(p_answers);
 if p_request_id is null or p_photo_sha256 is null or p_photo_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request or photograph fingerprint.' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('lead-application-'||p_request_id::text,0));
 select * into saved from public.lead_applications where request_id=p_request_id;
 if saved.id is null then return null;end if;
 if saved.user_id is not null or saved.answers is distinct from p_answers or saved.photo_sha256 is distinct from p_photo_sha256 then raise exception 'Request already contains another application.' using errcode='22023';end if;
 return saved.id;
end $$;
create function public.persist_public_lead_request(p_answers jsonb,p_request_id uuid,p_photo_path text,p_photo_sha256 text) returns public.lead_applications language plpgsql security definer set search_path='' as $$
declare saved public.lead_applications; completed uuid; campus uuid; university text:=p_answers->>'newUniversityName'; metadata jsonb;
begin
 completed:=public.completed_public_lead_request(p_request_id,p_answers,p_photo_sha256);
 if completed is not null then select * into saved from public.lead_applications where id=completed;return saved;end if;
 if p_photo_path is null or p_photo_path !~ ('^'||p_request_id::text||'/'||p_photo_sha256||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$') then raise exception 'Invalid photograph path.' using errcode='22023';end if;
 select o.metadata into metadata from storage.objects o where o.bucket_id='trainee-photos' and o.name=p_photo_path for share;
 if not found or metadata->>'mimetype' is distinct from 'image/png' or coalesce(metadata->>'size','') !~ '^[0-9]{1,7}$' then raise exception 'Photograph upload required.' using errcode='22023';end if;
 if (metadata->>'size')::bigint not between 1 and 3145728 then raise exception 'Invalid photograph size.' using errcode='22023';end if;
 if p_answers->>'kind'='existing' then
  campus:=(p_answers->>'campusId')::uuid;
  perform 1 from public.campuses where id=campus for share;
  if not found then raise exception 'Campus not found.' using errcode='22023';end if;
 else
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended('new-campus-'||lower(university),0));
  select id into campus from public.campuses where lower(trim(name))=lower(university) order by created_at limit 1;
  if campus is null then insert into public.campuses(name,region,is_active,lifecycle_status) values(university,'Unassigned',false,'in_process') returning id into campus;end if;
 end if;
 insert into public.lead_applications(campus_id,kind,answers,request_id,photo_path,photo_sha256) values(campus,p_answers->>'kind',p_answers,p_request_id,p_photo_path,p_photo_sha256) returning * into saved;
 insert into public.notifications(recipient_id,kind,title,message,campus_id,application_id) select id,'lead_application','New trainee request',p_answers->>'fullName'||' has requested trainee access for '||(select name from public.campuses where id=campus)||'. Review their request and photograph.',campus,saved.id from public.profiles where role='admin' and status='active';
 return saved;
end $$;
create function public.review_lead_request(p_id uuid,p_status text,p_reason text default null) returns public.lead_applications language plpgsql security definer set search_path='' as $$
declare actor public.profiles; saved public.lead_applications;
begin
 select * into actor from public.profiles where id=auth.uid() for share;
 if actor.id is null or actor.role<>'admin' or actor.status<>'active' then raise exception 'Active administrator required.' using errcode='42501';end if;
 if p_status is null or p_status not in ('approved','rejected') or char_length(coalesce(p_reason,''))>2000 then raise exception 'Invalid review decision.' using errcode='22023';end if;
 select * into saved from public.lead_applications where id=p_id for update;
 if not found then raise exception 'Request not found.' using errcode='22023';end if;
 if saved.status<>'pending' then
  if saved.status=p_status and saved.reviewed_by=actor.id and saved.review_reason is not distinct from nullif(trim(p_reason),'') then return saved;end if;
  raise exception 'Request already reviewed.' using errcode='22023';
 end if;
 update public.lead_applications set status=p_status,reviewed_by=actor.id,reviewed_at=now(),review_reason=nullif(trim(p_reason),'') where id=p_id returning * into saved;
 return saved;
end $$;
revoke all on function public.completed_public_lead_request(uuid,jsonb,text),public.persist_public_lead_request(jsonb,uuid,text,text),public.review_lead_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.completed_public_lead_request(uuid,jsonb,text),public.persist_public_lead_request(jsonb,uuid,text,text) to service_role;
grant execute on function public.review_lead_request(uuid,text,text) to authenticated;
