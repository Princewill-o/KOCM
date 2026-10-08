begin;
insert into auth.users(id,email,raw_app_meta_data) values
 ('80000000-0000-0000-0000-000000000001','roster-admin@example.test','{"koc_role":"admin"}'),
 ('80000000-0000-0000-0000-000000000002','roster-editor@example.test','{"koc_role":"editor"}');
insert into public.campuses(id,name,region,lifecycle_status) values
 ('81000000-0000-0000-0000-000000000001','Lifecycle active fixture','Unassigned','active'),
 ('81000000-0000-0000-0000-000000000002','Lifecycle inactive fixture','Unassigned','inactive'),
 ('81000000-0000-0000-0000-000000000003','Lifecycle process fixture','Unassigned','in_process');
insert into public.campus_leader_roster(campus_id,full_name,source_page,source_row,grade_label) values('81000000-0000-0000-0000-000000000002','Historical Test Person',9999,9999,'2026 snapshot');
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000001',true);
-- Historical fixtures bypass report API as postgres, but still use real report triggers.
insert into public.reports(campus_id,season_id,week_ending,attendance,prayer_minutes,evangelism_minutes,outreach_outings,submitted_by,updated_by)
select id,'2026-2027','2026-09-18',100,10,10,1,'80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001' from public.campuses where id::text like '81000000%';
set local role authenticated;
do $$ declare directory jsonb; begin
 directory:=public.admin_campus_roster();
 if not exists(select 1 from jsonb_array_elements(directory->'campuses') c where c->>'id'='81000000-0000-0000-0000-000000000003' and c->>'lifecycle_status'='in_process') then raise exception 'Admin missing process campus'; end if;
 if not exists(select 1 from jsonb_array_elements(directory->'leaders') r where r->>'full_name'='Historical Test Person') then raise exception 'Admin missing roster'; end if;
 if exists(select 1 from public.season_campus_summary() where campus_id in ('81000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003')) then raise exception 'Inactive campus included in summary'; end if;
 if exists(select 1 from public.quarter_campus_totals() where campus_id in ('81000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003')) then raise exception 'Inactive campus included in quarters'; end if;
 if (select attendance from public.season_weekly_totals() where week_ending='2026-09-18')<>100 then raise exception 'Inactive campus included in weekly totals'; end if;
 update public.campuses set lifecycle_status='inactive' where id='81000000-0000-0000-0000-000000000001';
 if exists(select 1 from public.campuses where id='81000000-0000-0000-0000-000000000001' and is_active) then raise exception 'Lifecycle flag not synchronized'; end if;
 update public.campuses set is_active=true where id='81000000-0000-0000-0000-000000000001';
 if not exists(select 1 from public.campuses where id='81000000-0000-0000-0000-000000000001' and lifecycle_status='active') then raise exception 'Legacy active update not synchronized'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.campus_leader_roster) then raise exception 'Editor can read roster'; end if;
 begin perform public.admin_campus_roster(); raise exception 'Editor can call admin directory'; exception when insufficient_privilege then null; end;
 begin insert into public.campus_leader_roster(campus_id,full_name,source_page,source_row) values('81000000-0000-0000-0000-000000000001','Forbidden',9999,9998); raise exception 'Browser roster write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin begin perform * from public.campus_leader_roster; raise exception 'Anonymous roster read allowed'; exception when insufficient_privilege then null; end; end $$;
reset role;
rollback;
