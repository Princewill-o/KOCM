-- Originals and unwatermarked raster pages are publisher-only.
alter table public.materials add column page_count integer not null default 0 check(page_count between 0 and 100), add column protected_ready boolean not null default false;
drop policy "Read assigned material files" on storage.objects;
create policy "Publishers read original PDFs" on storage.objects for select to authenticated using(bucket_id='koc-materials' and (select private.my_role()) in ('admin','editor'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('koc-material-pages','koc-material-pages',false,8388608,array['image/png']) on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/png'];
create table public.material_pages (
 material_id uuid not null references public.materials(id), page_number integer not null check(page_number between 1 and 100),
 object_path text not null unique, width integer not null check(width between 1 and 1600), height integer not null check(height between 1 and 2400),
 created_at timestamptz not null default now(), primary key(material_id,page_number)
);
alter table public.material_pages enable row level security;
revoke all on public.material_pages from public,anon,authenticated;
grant select on public.material_pages to authenticated;
create policy "Publishers inspect page metadata" on public.material_pages for select to authenticated using((select private.my_role()) in ('admin','editor'));
create policy "Publishers upload immutable pages" on storage.objects for insert to authenticated with check(
 bucket_id='koc-material-pages' and (select private.my_role()) in ('admin','editor') and
 name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/page-([1-9][0-9]?|100)\.png$' and split_part(name,'/',1)=(select auth.uid())::text and
 exists(select 1 from public.materials m where m.id::text=split_part(name,'/',2) and m.is_active and not m.protected_ready));
create policy "Publishers inspect raster pages" on storage.objects for select to authenticated using(bucket_id='koc-material-pages' and (select private.my_role()) in ('admin','editor'));
create function public.register_material_page(p_material_id uuid,p_page_number integer,p_object_path text,p_width integer,p_height integer)
returns void language plpgsql security definer set search_path='' as $$
declare m public.materials; begin
 if auth.uid() is null or (select private.my_role()) not in ('admin','editor') or (select private.my_role()) is null then raise exception 'Publisher required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id for update;
 if m.id is null or not m.is_active or m.protected_ready then raise exception 'Material unavailable for preparation.' using errcode='42501'; end if;
 if p_page_number is null or p_page_number not between 1 and 100 or p_width is null or p_width not between 1 and 1600 or p_height is null or p_height not between 1 and 2400 or p_object_path is distinct from auth.uid()::text||'/'||p_material_id::text||'/page-'||p_page_number::text||'.png' then raise exception 'Invalid protected page.' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='koc-material-pages' and name=p_object_path) then raise exception 'Upload page before registering.' using errcode='22023'; end if;
 insert into public.material_pages(material_id,page_number,object_path,width,height) values(p_material_id,p_page_number,p_object_path,p_width,p_height)
 on conflict(material_id,page_number) do nothing;
 if not exists(select 1 from public.material_pages where material_id=p_material_id and page_number=p_page_number and object_path=p_object_path and width=p_width and height=p_height) then raise exception 'Page already registered with different content.' using errcode='22023'; end if;
end $$;
create function public.finalize_material(p_material_id uuid,p_page_count integer) returns void language plpgsql security definer set search_path='' as $$
declare m public.materials; begin
 if auth.uid() is null or (select private.my_role()) not in ('admin','editor') or (select private.my_role()) is null then raise exception 'Publisher required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id for update;
 if m.id is null or not m.is_active or m.protected_ready then raise exception 'Material unavailable for preparation.' using errcode='42501'; end if;
 if p_page_count is null or p_page_count not between 1 and 100 or (select count(*) from public.material_pages where material_id=p_material_id)<>p_page_count or exists(select 1 from generate_series(1,p_page_count) n where not exists(select 1 from public.material_pages p join storage.objects o on o.bucket_id='koc-material-pages' and o.name=p.object_path where p.material_id=p_material_id and p.page_number=n)) then raise exception 'Complete contiguous uploaded pages required.' using errcode='22023'; end if;
 update public.materials set page_count=p_page_count,protected_ready=true where id=p_material_id;
end $$;
create table private.material_reader_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), material_id uuid not null references public.materials(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes'
);
create index material_reader_sessions_user_idx on private.material_reader_sessions(user_id,created_at);
create table private.material_page_audit (
 id bigint generated always as identity primary key, session_id uuid not null references private.material_reader_sessions(id),user_id uuid not null references public.profiles(id),material_id uuid not null references public.materials(id),page_number integer not null,created_at timestamptz not null default now()
);
create index material_page_audit_user_time_idx on private.material_page_audit(user_id,created_at);
alter table private.material_reader_sessions enable row level security;
alter table private.material_page_audit enable row level security;
revoke all on private.material_reader_sessions,private.material_page_audit from public,anon,authenticated;
create function public.protected_material_page_access(p_material_id uuid,p_page_number integer,p_session_id uuid default null)
returns table(session_id uuid,object_path text,watermark_identity text,page_count integer)
language plpgsql security definer set search_path='' as $$
declare u public.profiles; m public.materials; s private.material_reader_sessions; page public.material_pages; begin
 -- Serialize requests per reader so concurrent clients cannot evade session/rate limits.
 select * into u from public.profiles where id=auth.uid() for update;
 if u.id is null or u.status<>'active' then raise exception 'Active account required.' using errcode='42501'; end if;
 select * into m from public.materials where id=p_material_id;
 if m.id is null or not m.is_active or not m.protected_ready or (u.role not in ('admin','editor') and m.campus_id is not null and not private.can_access_campus(m.campus_id)) then raise exception 'Material access denied.' using errcode='42501'; end if;
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
revoke all on function public.register_material_page(uuid,integer,text,integer,integer),public.finalize_material(uuid,integer),public.protected_material_page_access(uuid,integer,uuid) from public,anon;
grant execute on function public.register_material_page(uuid,integer,text,integer,integer),public.finalize_material(uuid,integer),public.protected_material_page_access(uuid,integer,uuid) to authenticated;
-- Publishers cannot bypass verified publication by writing these columns directly.
revoke insert on public.materials from authenticated;
grant insert(id,title,description,object_path,campus_id,uploaded_by,is_active) on public.materials to authenticated;

create policy "Publishers retry unpublished page uploads" on storage.objects for update to authenticated
 using(bucket_id='koc-material-pages' and (select private.my_role()) in ('admin','editor') and split_part(name,'/',1)=(select auth.uid())::text and exists(select 1 from public.materials m where m.id::text=split_part(name,'/',2) and m.is_active and not m.protected_ready))
 with check(bucket_id='koc-material-pages' and (select private.my_role()) in ('admin','editor') and split_part(name,'/',1)=(select auth.uid())::text and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/page-([1-9][0-9]?|100)\.png$' and exists(select 1 from public.materials m where m.id::text=split_part(name,'/',2) and m.is_active and not m.protected_ready));
