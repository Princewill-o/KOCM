-- Scoped campus workflows. No real accounts or campus coordinates are invented.
create table public.clusters (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 lead_name text not null, is_active boolean not null default true
);
insert into public.clusters(name,lead_name) values
 ('London','Modupe'),('Midlands','Elyon'),('South','Lindsay'),('North','Naa'),('South East','Zipporah'),('West','Chiedza');
alter table public.campuses add column cluster_id uuid references public.clusters(id),
 add column latitude numeric check(latitude between -90 and 90),
 add column longitude numeric check(longitude between -180 and 180),
 add column address text not null default '', add column meeting_info text not null default '',
 add column contact_email text not null default '';
update public.campuses c set cluster_id = x.id from public.clusters x
 where x.name = case when c.region = 'West England' then 'West' else c.region end;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','editor','campus','cluster'));
alter table public.profiles add column cluster_id uuid references public.clusters(id),
 add constraint cluster_role_scope check(role <> 'cluster' or cluster_id is not null);
create index profiles_cluster_idx on public.profiles(cluster_id);
create index campuses_cluster_idx on public.campuses(cluster_id);
create function private.can_access_campus(p_campus_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active'
 and (p.role in ('admin','editor') or (p.role = 'campus' and p.campus_id = p_campus_id)
 or (p.role = 'cluster' and exists(select 1 from public.campuses c where c.id = p_campus_id and c.cluster_id = p.cluster_id))))
$$;
revoke all on function private.can_access_campus(uuid) from public,anon;
grant execute on function private.can_access_campus(uuid) to authenticated;
drop policy "Reports visible by role" on public.reports;
create policy "Reports visible by scope" on public.reports for select to authenticated using(private.can_access_campus(campus_id));
-- Prevent a new cluster role falling through the older submit RPC's privileged branch.
create function private.enforce_report_scope() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (select private.my_role()) = 'cluster' then raise exception 'Cluster leads have read-only report access.' using errcode='42501'; end if;
 if tg_op = 'INSERT' then
   new.submitted_at := now();
   new.is_late := now() > public.report_deadline(new.week_ending,new.season_id);
 end if;
 return new;
end $$;
revoke all on function private.enforce_report_scope() from public,anon,authenticated;
create trigger reports_scope before insert or update on public.reports for each row execute function private.enforce_report_scope();
create table public.grades (
 id uuid primary key default gen_random_uuid(), campus_id uuid not null references public.campuses(id),
 student_name text not null check(char_length(trim(student_name)) between 2 and 160),
 course text not null check(char_length(course) between 1 and 200), assessment text not null check(char_length(assessment) between 1 and 200),
 percentage numeric not null check(percentage between 0 and 100), assessment_date date not null,
 notes text not null default '' check(char_length(notes)<=2000),
 submitted_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index grades_campus_idx on public.grades(campus_id,assessment_date);
create index grades_submitter_idx on public.grades(submitted_by);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), campus_id uuid not null references public.campuses(id),
 full_name text not null check(char_length(trim(full_name)) between 2 and 160),
 phone text not null check(phone ~ '^\+?[0-9 ()-]{7,30}$'),
 fellowship_attended boolean not null default false, branch_attended boolean not null default false,
 notes text not null default '' check(char_length(notes)<=2000), is_active boolean not null default true,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index contacts_campus_idx on public.contacts(campus_id);
create index contacts_creator_idx on public.contacts(created_by);
create trigger contacts_touch before update on public.contacts for each row execute function private.touch_updated_at();
create table public.notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('late_report','low_grade')),title text not null,message text not null,
 campus_id uuid not null references public.campuses(id), report_id uuid references public.reports(id) on delete cascade,
 grade_id uuid references public.grades(id),created_at timestamptz not null default now(),read_at timestamptz,
 unique(recipient_id,report_id),unique(recipient_id,grade_id)
);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc);
create index notifications_campus_idx on public.notifications(campus_id);
create index notifications_report_idx on public.notifications(report_id);
create index notifications_grade_idx on public.notifications(grade_id);
create table public.materials (
 id uuid primary key default gen_random_uuid(),title text not null check(char_length(trim(title)) between 2 and 200),
 description text not null default '' check(char_length(description)<=2000),object_path text not null unique,
 campus_id uuid references public.campuses(id), uploaded_by uuid not null default auth.uid() references public.profiles(id),
 is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(object_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$')
);
create index materials_campus_idx on public.materials(campus_id);
create index materials_uploader_idx on public.materials(uploaded_by);
create trigger materials_touch before update on public.materials for each row execute function private.touch_updated_at();
alter table public.clusters enable row level security;
alter table public.grades enable row level security;
alter table public.contacts enable row level security;
alter table public.notifications enable row level security;
alter table public.materials enable row level security;
revoke all on public.clusters,public.grades,public.contacts,public.notifications,public.materials from anon,authenticated;
grant select on public.clusters,public.grades,public.contacts,public.notifications,public.materials to authenticated;
grant insert on public.contacts,public.materials to authenticated;
grant update(full_name,phone,fellowship_attended,branch_attended,notes,is_active) on public.contacts to authenticated;
grant update(title,description,is_active) on public.materials to authenticated;
create policy "Active users list clusters" on public.clusters for select to authenticated using((select private.my_role()) is not null);
create policy "Scoped grades" on public.grades for select to authenticated using(private.can_access_campus(campus_id));
create policy "Scoped contacts" on public.contacts for select to authenticated using(private.can_access_campus(campus_id));
create policy "Campus contacts insert" on public.contacts for insert to authenticated with check(
 created_by=(select auth.uid()) and ((select private.my_role()) in ('admin','editor') or campus_id=(select private.my_campus())));
create policy "Campus contacts update" on public.contacts for update to authenticated
 using((select private.my_role()) in ('admin','editor') or campus_id=(select private.my_campus()))
 with check((select private.my_role()) in ('admin','editor') or campus_id=(select private.my_campus()));
create policy "Own notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) and (select private.my_role()) is not null);
create policy "Scoped materials" on public.materials for select to authenticated using(
 (select private.my_role()) in ('admin','editor') or (is_active and (select private.my_role()) is not null and (campus_id is null or private.can_access_campus(campus_id))));
create policy "Leads publish materials" on public.materials for insert to authenticated with check(
 (select private.my_role()) in ('admin','editor') and uploaded_by=(select auth.uid()) and split_part(object_path,'/',1)=(select auth.uid())::text);
create policy "Leads update materials" on public.materials for update to authenticated
 using((select private.my_role()) in ('admin','editor')) with check((select private.my_role()) in ('admin','editor'));
create function private.notify_late_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_late then
 insert into public.notifications(recipient_id,kind,title,message,campus_id,report_id)
 select p.id,'late_report','Weekly report submitted late',c.name||' submitted the report for '||new.week_ending||' after Friday 10pm (Europe/London).',new.campus_id,new.id
 from public.profiles p cross join public.campuses c where p.status='active' and p.role in ('admin','editor') and c.id=new.campus_id;
 end if; return new;
end $$;
create trigger late_report_notifications after insert on public.reports for each row execute function private.notify_late_report();
revoke all on function private.notify_late_report() from public,anon,authenticated;
create function public.submit_grade(p_campus_id uuid,p_student_name text,p_course text,p_assessment text,p_percentage numeric,p_assessment_date date,p_notes text default '')
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
 where p.status='active' and (p.role in ('admin','editor') or (p.role='cluster' and p.cluster_id=c.cluster_id));
 end if; return g;
end $$;
create function public.acknowledge_notification(p_notification_id uuid) returns public.notifications
language plpgsql security definer set search_path='' as $$
declare n public.notifications; begin
 if (select private.my_role()) is null then raise exception 'Active account required.' using errcode='42501'; end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid() returning * into n;
 if n.id is null then raise exception 'Notification not found.' using errcode='42501'; end if; return n;
end $$;
revoke all on function public.submit_grade(uuid,text,text,text,numeric,date,text),public.acknowledge_notification(uuid) from public,anon;
grant execute on function public.submit_grade(uuid,text,text,text,numeric,date,text),public.acknowledge_notification(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('koc-materials','koc-materials',false,20971520,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];
create policy "Leads upload PDFs" on storage.objects for insert to authenticated with check(
 bucket_id='koc-materials' and (select private.my_role()) in ('admin','editor') and (storage.foldername(name))[1]=(select auth.uid())::text and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$');
create policy "Read assigned material files" on storage.objects for select to authenticated using(
 bucket_id='koc-materials' and ((select private.my_role()) in ('admin','editor') or exists(select 1 from public.materials m where m.object_path=name and m.is_active)));
-- Immutable uploads: replacing an existing object is deliberately disallowed.
create function public.quarter_campus_totals() returns table(year int,quarter int,campus_id uuid,campus_name text,reports bigint,attendance bigint,prayer_minutes bigint,evangelism_minutes bigint,outreach_outings bigint)
language sql stable security invoker set search_path='' as $$
 select extract(year from r.week_ending)::int,extract(quarter from r.week_ending)::int,c.id,c.name::text,count(*),sum(r.attendance),sum(r.prayer_minutes),sum(r.evangelism_minutes),sum(r.outreach_outings)
 from public.reports r join public.campuses c on c.id=r.campus_id group by 1,2,c.id,c.name order by 1,2,c.name
$$;
revoke all on function public.quarter_campus_totals() from public,anon;
grant execute on function public.quarter_campus_totals() to authenticated;

drop function public.admin_update_user(uuid,text,text,uuid,text);
create function public.admin_update_user(
  p_user_id uuid,
  p_role text default null,
  p_status text default null,
  p_campus_id uuid default null,
  p_full_name text default null,
  p_cluster_id uuid default null
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
  select * into target from public.profiles where id = p_user_id for update;
  if target.id is null then raise exception 'Account not found.' using errcode = '22023'; end if;

  v_role := coalesce(p_role, target.role);
  v_status := coalesce(p_status, target.status);
  v_campus := case when v_role = 'campus' then coalesce(p_campus_id, target.campus_id) else null end;
  v_cluster := case when v_role = 'cluster' then coalesce(p_cluster_id, target.cluster_id) else null end;
  if v_role = 'cluster' and (v_cluster is null or not exists(select 1 from public.clusters where id=v_cluster and is_active)) then raise exception 'Cluster leads need an active cluster.' using errcode='22023'; end if;
  if v_role not in ('admin', 'editor', 'campus','cluster') then raise exception 'Invalid role.' using errcode = '22023'; end if;
  if v_status not in ('pending', 'active', 'rejected') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if v_role = 'campus' and (v_campus is null or not exists (select 1 from public.campuses where id = v_campus)) then
    raise exception 'Campus representatives need a university.' using errcode = '22023';
  end if;

  -- Never leave the system without an active administrator.
  if target.role = 'admin' and target.status = 'active' and (v_role <> 'admin' or v_status <> 'active')
     and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
    raise exception 'At least one active administrator is required.' using errcode = '42501';
  end if;

  update public.profiles set
    role = v_role, status = v_status, campus_id = v_campus, cluster_id = v_cluster,
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = p_user_id
  returning * into target;
  return target;
end $$;


revoke all on function public.admin_update_user(uuid,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.admin_update_user(uuid,text,text,uuid,text,uuid) to authenticated;

create or replace function public.season_campus_summary(p_season_id text default null)
returns table (campus_id uuid, campus_name text, region text, reports bigint, late_reports bigint,
               attendance bigint, prayer_minutes bigint, evangelism_minutes bigint, outreach_outings bigint,
               last_week date)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.name::text, c.region::text, count(r.id), count(r.id) filter (where r.is_late),
         coalesce(sum(r.attendance), 0), coalesce(sum(r.prayer_minutes), 0),
         coalesce(sum(r.evangelism_minutes), 0), coalesce(sum(r.outreach_outings), 0), max(r.week_ending)
  from public.campuses c
  left join public.reports r on r.campus_id = c.id
    and r.season_id = coalesce(p_season_id, (select id from public.seasons where is_current))
  where c.is_active
    and private.can_access_campus(c.id)
  group by c.id, c.name, c.region
  order by c.name
$$;


-- Permit compensating removal only for the uploader's unpublished orphan file.
create policy "Leads remove own unpublished PDFs" on storage.objects for delete to authenticated
 using(bucket_id='koc-materials' and (select private.my_role()) in ('admin','editor')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.materials m where m.object_path=name));
