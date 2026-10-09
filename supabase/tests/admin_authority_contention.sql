-- Local disposable PostgreSQL concurrency regression. Requires bundled dblink.
-- Fixtures are synthetic; the runner drops its disposable database on failure.
do $$ begin if current_database() !~ '^koc_workflow_test_[a-f0-9]+$' then raise exception 'Refusing contention fixtures outside disposable local test database';end if;end $$;
create extension if not exists dblink;
insert into auth.users(id,email,raw_app_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','lock-admin-a@example.test','{"koc_role":"admin"}'),
 ('a0000000-0000-0000-0000-000000000002','lock-admin-b@example.test','{"koc_role":"admin"}'),
 ('a0000000-0000-0000-0000-000000000003','lock-target@example.test','{"koc_role":"editor"}');
do $$ declare connection text:=format('dbname=%L host=127.0.0.1 port=%s user=%L',current_database(),current_setting('port'),current_user); denied boolean:=false; waiting boolean:=false; begin
 perform dblink_connect('authority_blocker',connection);
 perform dblink_connect('authority_waiter',connection);
 perform dblink_exec('authority_blocker','begin');
 perform dblink_exec('authority_blocker','do $remote$ begin perform pg_advisory_xact_lock(73612061); end $remote$');
 perform dblink_exec('authority_blocker',$remote$update public.profiles set role='campus',status='pending',campus_id=null where id='a0000000-0000-0000-0000-000000000002'$remote$);
 perform dblink_exec('authority_waiter',$remote$set request.jwt.claim.sub='a0000000-0000-0000-0000-000000000002'$remote$);
 perform dblink_exec('authority_waiter','set role authenticated');
 perform dblink_send_query('authority_waiter',$remote$select (public.admin_update_user('a0000000-0000-0000-0000-000000000003',p_full_name=>'Forbidden queued edit')).id::text$remote$);
 for i in 1..100 loop
  select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='advisory' and query like '%Forbidden queued edit%') into waiting;
  exit when waiting; perform pg_sleep(.02);
 end loop;
 if not waiting then raise exception 'Admin request did not reach the contention gate'; end if;
 perform dblink_exec('authority_blocker','commit');
 begin perform * from dblink_get_result('authority_waiter') as r(id text); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked admin executed a queued edit';end if;
 if exists(select 1 from public.profiles where id='a0000000-0000-0000-0000-000000000003' and full_name='Forbidden queued edit') then raise exception 'Revoked edit was persisted';end if;
 perform dblink_disconnect('authority_blocker');perform dblink_disconnect('authority_waiter');
end $$;
-- Remove only this test's audit fixtures before deleting its synthetic Auth users.
delete from private.account_access_audit where user_id in ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003');
delete from auth.users where id in ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003');
