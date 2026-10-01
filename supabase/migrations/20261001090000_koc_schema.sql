-- Kharis On Campus (KOC) Management — Supabase schema
-- Roles: admin (full access), editor (enter/view stats for every campus), campus (own campus only)

create schema if not exists private;
grant usage on schema private to authenticated;

-- ── Seasons ────────────────────────────────────────────────────────────────
create table public.seasons (
  id text primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  deadline_hour int not null default 22 check (deadline_hour between 0 and 23),
  time_zone text not null default 'Europe/London',
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (extract(isodow from start_date) = 5)
);
create unique index one_current_season on public.seasons (is_current) where is_current;

-- ── Campuses ───────────────────────────────────────────────────────────────
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null unique,
  region varchar(80) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Profiles (one per auth user) ───────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name varchar(100) not null check (char_length(trim(full_name)) >= 2),
  email varchar(254) not null,
  role text not null default 'campus' check (role in ('admin', 'editor', 'campus')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  campus_id uuid references public.campuses (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'campus' or campus_id is not null)
);
create index profiles_campus_idx on public.profiles (campus_id);

-- ── Weekly reports ─────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses (id),
  season_id text not null references public.seasons (id),
  week_ending date not null,
  attendance int not null check (attendance between 0 and 100000),
  prayer_minutes int not null check (prayer_minutes between 0 and 1000000),
  evangelism_minutes int not null check (evangelism_minutes between 0 and 1000000),
  outreach_outings int not null check (outreach_outings between 0 and 10000),
  notes text not null default '' check (char_length(notes) <= 2000),
  submitted_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_late boolean not null default false,
  unique (campus_id, season_id, week_ending)
);
create index reports_season_idx on public.reports (season_id, week_ending);
create index reports_submitted_by_idx on public.reports (submitted_by);
create index reports_updated_by_idx on public.reports (updated_by);

create table public.report_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index report_audit_report_idx on public.report_audit (report_id);
create index report_audit_actor_idx on public.report_audit (actor_id);

-- ── Helpers (private schema: not exposed through the API) ──────────────────
create function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and status = 'active'
$$;

create function private.my_campus() returns uuid
language sql stable security definer set search_path = '' as $$
  select campus_id from public.profiles
  where id = (select auth.uid()) and status = 'active' and role = 'campus'
$$;

revoke all on function private.my_role() from public, anon;
revoke all on function private.my_campus() from public, anon;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_campus() to authenticated;

-- ── New auth user → profile ────────────────────────────────────────────────
-- Role can ONLY come from app metadata (set by an administrator / service role),
-- never from user-editable signup metadata. Self sign-ups are always pending campus reps.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := coalesce(new.raw_app_meta_data ->> 'koc_role', 'campus');
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_campus uuid;
begin
  if v_role not in ('admin', 'editor', 'campus') then v_role := 'campus'; end if;
  if v_role = 'campus' then
    begin
      v_campus := (new.raw_user_meta_data ->> 'campus_id')::uuid;
    exception when others then v_campus := null;
    end;
    if v_campus is null or not exists (select 1 from public.campuses where id = v_campus and is_active) then
      raise exception 'Select an active university.';
    end if;
  end if;
  insert into public.profiles (id, full_name, email, role, status, campus_id)
  values (new.id, left(v_name, 100), lower(new.email), v_role,
          case when v_role = 'campus' then 'pending' else 'active' end,
          case when v_role = 'campus' then v_campus else null end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now() where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function private.sync_profile_email();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger campuses_touch before update on public.campuses
for each row execute function private.touch_updated_at();

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.seasons enable row level security;
alter table public.campuses enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_audit enable row level security;

-- Table privileges: reads go through RLS; all writes except own name go through functions.
revoke all on public.seasons, public.campuses, public.profiles, public.reports, public.report_audit from anon, authenticated;
grant select on public.seasons, public.campuses to anon, authenticated;
grant select on public.profiles, public.reports, public.report_audit to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert, update on public.campuses to authenticated;

create policy "Seasons are public" on public.seasons for select to anon, authenticated using (true);

create policy "Anyone can list active campuses" on public.campuses for select to anon using (is_active);
create policy "Signed-in users list campuses; admins see inactive too" on public.campuses for select to authenticated
  using (is_active or (select private.my_role()) = 'admin');
create policy "Admins add campuses" on public.campuses for insert to authenticated
  with check ((select private.my_role()) = 'admin');
create policy "Admins edit campuses" on public.campuses for update to authenticated
  using ((select private.my_role()) = 'admin') with check ((select private.my_role()) = 'admin');

create policy "See own profile; admins see everyone" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.my_role()) = 'admin');
create policy "Update own name" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Reports visible by role" on public.reports for select to authenticated
  using ((select private.my_role()) in ('admin', 'editor')
         or ((select private.my_role()) = 'campus' and campus_id = (select private.my_campus())));

create policy "Admins read audit history" on public.report_audit for select to authenticated
  using ((select private.my_role()) = 'admin');

-- ── Reporting functions ────────────────────────────────────────────────────
create function public.report_deadline(p_week_ending date, p_season_id text default null)
returns timestamptz language sql stable set search_path = '' as $$
  select (p_week_ending::timestamp + make_interval(hours => s.deadline_hour)) at time zone s.time_zone
  from public.seasons s
  where s.id = coalesce(p_season_id, (select id from public.seasons where is_current))
$$;

create function public.submit_report(
  p_week_ending date,
  p_attendance int,
  p_prayer_minutes int,
  p_evangelism_minutes int,
  p_outreach_outings int,
  p_notes text default '',
  p_campus_id uuid default null
) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  s public.seasons;
  v_campus uuid;
  v_open timestamptz;
  v_deadline timestamptz;
  v_notes text := trim(coalesce(p_notes, ''));
  r public.reports;
begin
  select * into me from public.profiles where id = (select auth.uid());
  if me.id is null then raise exception 'Please log in.' using errcode = '28000'; end if;
  if me.status <> 'active' then raise exception 'Your account must be approved before submitting reports.' using errcode = '42501'; end if;

  if me.role = 'campus' then
    if p_campus_id is not null and p_campus_id <> me.campus_id then
      raise exception 'You can only submit reports for your own university.' using errcode = '42501';
    end if;
    v_campus := me.campus_id;
  else
    v_campus := p_campus_id;
    if v_campus is null then raise exception 'Select a university.' using errcode = '22023'; end if;
  end if;
  if not exists (select 1 from public.campuses where id = v_campus and is_active) then
    raise exception 'University not found or inactive.' using errcode = '22023';
  end if;

  select * into s from public.seasons where is_current;
  if s.id is null then raise exception 'No reporting season is open.' using errcode = '22023'; end if;
  if p_week_ending is null or p_week_ending < s.start_date or p_week_ending > s.end_date then
    raise exception 'Choose a week in the reporting season.' using errcode = '22023';
  end if;
  if extract(isodow from p_week_ending) <> 5 then
    raise exception 'Reports must end on a Friday.' using errcode = '22023';
  end if;
  v_open := ((p_week_ending - 6)::timestamp) at time zone s.time_zone;
  if now() < v_open then raise exception 'This reporting week has not started yet.' using errcode = '22023'; end if;

  if p_attendance is null or p_attendance not between 0 and 100000
     or p_prayer_minutes is null or p_prayer_minutes not between 0 and 1000000
     or p_evangelism_minutes is null or p_evangelism_minutes not between 0 and 1000000
     or p_outreach_outings is null or p_outreach_outings not between 0 and 10000 then
    raise exception 'Enter whole numbers of zero or more.' using errcode = '22023';
  end if;
  if char_length(v_notes) > 2000 then raise exception 'Notes must be 2000 characters or fewer.' using errcode = '22023'; end if;

  v_deadline := (p_week_ending::timestamp + make_interval(hours => s.deadline_hour)) at time zone s.time_zone;

  insert into public.reports as t (campus_id, season_id, week_ending, attendance, prayer_minutes, evangelism_minutes,
                                   outreach_outings, notes, submitted_by, updated_by, submitted_at, updated_at, is_late)
  values (v_campus, s.id, p_week_ending, p_attendance, p_prayer_minutes, p_evangelism_minutes,
          p_outreach_outings, v_notes, me.id, me.id, now(), now(), now() >= v_deadline)
  on conflict (campus_id, season_id, week_ending) do update set
    attendance = excluded.attendance,
    prayer_minutes = excluded.prayer_minutes,
    evangelism_minutes = excluded.evangelism_minutes,
    outreach_outings = excluded.outreach_outings,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into r;

  insert into public.report_audit (report_id, actor_id, snapshot) values (r.id, me.id, to_jsonb(r));
  return r;
end $$;

create function public.delete_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select private.my_role()) is distinct from 'admin' then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  delete from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found.' using errcode = '22023'; end if;
end $$;

-- Per-campus season totals (security invoker → RLS decides which campuses appear)
create function public.season_campus_summary(p_season_id text default null)
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
    and ((select private.my_role()) in ('admin', 'editor') or c.id = (select private.my_campus()))
  group by c.id, c.name, c.region
  order by c.name
$$;

-- Week-by-week totals across every visible campus
create function public.season_weekly_totals(p_season_id text default null)
returns table (week_ending date, campuses_reported bigint, attendance bigint, prayer_minutes bigint,
               evangelism_minutes bigint, outreach_outings bigint)
language sql stable security invoker set search_path = '' as $$
  select r.week_ending, count(*), sum(r.attendance), sum(r.prayer_minutes), sum(r.evangelism_minutes), sum(r.outreach_outings)
  from public.reports r
  where r.season_id = coalesce(p_season_id, (select id from public.seasons where is_current))
  group by r.week_ending
  order by r.week_ending
$$;

-- ── Admin account management ───────────────────────────────────────────────
create function public.admin_update_user(
  p_user_id uuid,
  p_role text default null,
  p_status text default null,
  p_campus_id uuid default null,
  p_full_name text default null
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
  v_role text;
  v_status text;
  v_campus uuid;
begin
  if (select private.my_role()) is distinct from 'admin' then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if target.id is null then raise exception 'Account not found.' using errcode = '22023'; end if;

  v_role := coalesce(p_role, target.role);
  v_status := coalesce(p_status, target.status);
  v_campus := case when v_role = 'campus' then coalesce(p_campus_id, target.campus_id) else null end;
  if v_role not in ('admin', 'editor', 'campus') then raise exception 'Invalid role.' using errcode = '22023'; end if;
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
    role = v_role, status = v_status, campus_id = v_campus,
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = p_user_id
  returning * into target;
  return target;
end $$;

create function public.admin_set_user_email(p_user_id uuid, p_email text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  target public.profiles;
begin
  if (select private.my_role()) is distinct from 'admin' then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception 'That email is already used by another account.' using errcode = '23505';
  end if;
  update auth.users set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()),
         email_change = '', email_change_token_new = '', email_change_token_current = '', updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'Account not found.' using errcode = '22023'; end if;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
  where user_id = p_user_id and provider = 'email';
  select * into target from public.profiles where id = p_user_id;
  return target;
end $$;

-- ── Function privileges ────────────────────────────────────────────────────
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.sync_profile_email() from public, anon, authenticated;
revoke all on function public.submit_report(date, int, int, int, int, text, uuid) from public, anon;
revoke all on function public.delete_report(uuid) from public, anon;
revoke all on function public.season_campus_summary(text) from public, anon;
revoke all on function public.season_weekly_totals(text) from public, anon;
revoke all on function public.admin_update_user(uuid, text, text, uuid, text) from public, anon;
revoke all on function public.admin_set_user_email(uuid, text) from public, anon;
revoke all on function public.report_deadline(date, text) from public;
grant execute on function public.submit_report(date, int, int, int, int, text, uuid) to authenticated;
grant execute on function public.delete_report(uuid) to authenticated;
grant execute on function public.season_campus_summary(text) to authenticated;
grant execute on function public.season_weekly_totals(text) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.admin_set_user_email(uuid, text) to authenticated;
grant execute on function public.report_deadline(date, text) to anon, authenticated;

-- ── Seed data ──────────────────────────────────────────────────────────────
insert into public.seasons (id, name, start_date, end_date, is_current)
values ('2026-2027', '2026–2027', '2026-09-18', '2027-05-28', true);

insert into public.campuses (name, region) values
 ('Anglia Ruskin','South East'),('Aston','Midlands'),('Birmingham City','Midlands'),('Bournemouth','South'),
 ('Brighton','South'),('Bristol','West England'),('Brunel','London'),('Cardiff','West England'),('CCCU','South East'),
 ('City of London','London'),('Colleges','Colleges'),('Derby','North'),('DMU','North'),('Exeter','West England'),
 ('Hertfordshire','London'),('Kingston','London'),('Leicester','North'),('Liverpool','North'),('Loughborough','Midlands'),
 ('Medway','South East'),('Middlesex','London'),('Northampton','Midlands'),('Nottingham Trent','North'),
 ('Oxford Brookes','West England'),('Portsmouth','South'),('QMUL','London'),('Reading','West England'),('Surrey','London'),
 ('UKC','South East'),('University of Birmingham','Midlands'),('UOL – Manchester','North'),('University of Nottingham','North'),
 ('UWE','West England'),('Warwick','Midlands'),('Wolverhampton','Midlands');
