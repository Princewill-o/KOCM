-- Lifecycle is independent from account approval. Historical source roster is admin-only.
alter table public.campuses add column lifecycle_status text;
update public.campuses set lifecycle_status=case when is_active then 'active' else 'inactive' end;
alter table public.campuses alter column lifecycle_status set default 'active',alter column lifecycle_status set not null;
alter table public.campuses add constraint campus_lifecycle_status_check check(lifecycle_status in ('active','inactive','in_process')),
 add constraint campus_lifecycle_active_consistent check(is_active=(lifecycle_status='active'));
create function private.sync_campus_lifecycle() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  -- Legacy callers supplying only is_active=false get the inactive lifecycle.
  if new.lifecycle_status='active' and not new.is_active then new.lifecycle_status:='inactive';
  else new.is_active:=(new.lifecycle_status='active'); end if;
 elsif new.lifecycle_status is distinct from old.lifecycle_status and new.is_active is distinct from old.is_active then
  if new.is_active is distinct from (new.lifecycle_status='active') then raise exception 'Campus status and active flag disagree.' using errcode='22023'; end if;
 elsif new.lifecycle_status is distinct from old.lifecycle_status then new.is_active:=(new.lifecycle_status='active');
 elsif new.is_active is distinct from old.is_active then new.lifecycle_status:=case when new.is_active then 'active' else 'inactive' end;
 end if;
 return new;
end $$;
revoke all on function private.sync_campus_lifecycle() from public,anon,authenticated;
create trigger campuses_sync_lifecycle before insert or update on public.campuses for each row execute function private.sync_campus_lifecycle();
create index campuses_lifecycle_idx on public.campuses(lifecycle_status);
create table public.campus_leader_roster(
 id uuid primary key default gen_random_uuid(),campus_id uuid not null references public.campuses(id),
 full_name text not null check(char_length(trim(full_name)) between 2 and 160),
 course text not null default '' check(char_length(course)<=300),study_year_text text not null default '' check(char_length(study_year_text)<=100),
 grade_label text not null default '' check(char_length(grade_label)<=100),training_attendance text not null default '' check(char_length(training_attendance)<=300),
 portrait_data text check(portrait_data is null or (octet_length(portrait_data)<=102400 and portrait_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')),
 source_page integer not null check(source_page between 1 and 10000),source_row integer not null check(source_row between 1 and 10000),
 account_id uuid references public.profiles(id),snapshot_year integer not null default 2026 check(snapshot_year between 2000 and 2100),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(source_page,source_row)
);
create index campus_leader_roster_campus_idx on public.campus_leader_roster(campus_id);
create index campus_leader_roster_account_idx on public.campus_leader_roster(account_id);
create trigger campus_roster_touch before update on public.campus_leader_roster for each row execute function private.touch_updated_at();
alter table public.campus_leader_roster enable row level security;
revoke all on public.campus_leader_roster from anon,authenticated;
grant select on public.campus_leader_roster to authenticated;
create policy "Administrators read historical roster" on public.campus_leader_roster for select to authenticated using((select private.my_role())='admin');
create function public.admin_campus_roster() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if (select private.my_role()) is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501'; end if;
 return jsonb_build_object('campuses',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.campuses c),'[]'::jsonb),
 'leaders',coalesce((select jsonb_agg(to_jsonb(r) order by r.source_page,r.source_row) from public.campus_leader_roster r),'[]'::jsonb));
end $$;
revoke all on function public.admin_campus_roster() from public,anon;
grant execute on function public.admin_campus_roster() to authenticated;
create or replace function public.season_weekly_totals(p_season_id text default null)
returns table(week_ending date,campuses_reported bigint,attendance bigint,prayer_minutes bigint,evangelism_minutes bigint,outreach_outings bigint)
language sql stable security invoker set search_path='' as $$
 select r.week_ending,count(*),sum(r.attendance),sum(r.prayer_minutes),sum(r.evangelism_minutes),sum(r.outreach_outings)
 from public.reports r join public.campuses c on c.id=r.campus_id and c.is_active
 where r.season_id=coalesce(p_season_id,(select id from public.seasons where is_current)) group by r.week_ending order by r.week_ending
$$;
create or replace function public.quarter_campus_totals()
returns table(year int,quarter int,campus_id uuid,campus_name text,reports bigint,attendance bigint,prayer_minutes bigint,evangelism_minutes bigint,outreach_outings bigint)
language sql stable security invoker set search_path='' as $$
 select extract(year from r.week_ending)::int,extract(quarter from r.week_ending)::int,c.id,c.name::text,count(*),sum(r.attendance),sum(r.prayer_minutes),sum(r.evangelism_minutes),sum(r.outreach_outings)
 from public.reports r join public.campuses c on c.id=r.campus_id and c.is_active group by 1,2,c.id,c.name order by 1,2,c.name
$$;
