begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
insert into auth.users(id,email,raw_app_meta_data,email_confirmed_at) values
 ('80000000-0000-0000-0000-000000000001','verified-admin@example.org','{"koc_role":"admin"}',now()),
 ('80000000-0000-0000-0000-000000000002','pending-admin@example.org','{"koc_role":"admin"}',null),
 ('80000000-0000-0000-0000-000000000003','campus-digest@example.org','{}',now());
update public.profiles set role='campus',status='active',campus_id=(select id from public.campuses where name='Brunel') where id='80000000-0000-0000-0000-000000000003';
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-23 21:59+00')=0,'not sent before23BST');
insert into public.reports(campus_id,season_id,week_ending,attendance,prayer_minutes,evangelism_minutes,outreach_outings,submitted_by,updated_by)
 values((select id from public.campuses where name='Brunel'),'2026-2027','2026-10-23',0,0,0,0,'80000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000003');
-- Fixtures explicitly model submission timing while preserving production scope/deadline triggers.
update public.reports set submitted_at='2026-10-23 21:30+00',is_late=true where week_ending='2026-10-23';
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-23 22:00+00')=1,'BST23queuesverifiedadminonly');
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-23 22:15+00')=0,'idempotent weekly admin delivery');
select pg_temp.assert_true((select jsonb_array_length(payload->'late')=1 and (payload->'late'->0->>'campus') like 'Brunel%' from private.account_email_deliveries where kind='weekly_digest'),'late submission retained');
select pg_temp.assert_true((select not exists(select 1 from jsonb_array_elements_text(payload->'missing') m where m like 'Brunel%') from private.account_email_deliveries where kind='weekly_digest'),'zero activity is submitted not missing');
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-30 22:00+00')=0,'GMT22not23');
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-30 23:00+00')=1,'GMT23queuesnextweek');
select pg_temp.assert_true(private.queue_weekly_admin_digest('2026-10-31 23:00+00')=0,'notSaturday');
set local role authenticated;
do $$ begin
 begin perform private.queue_weekly_admin_digest(); raise exception 'Browser queues digest'; exception when insufficient_privilege then null; end;
 begin perform public.verify_account_email_worker('wrong'); raise exception 'Browser verifies secret'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_true(public.verify_account_email_worker('wrong')=false,'invalid worker token rejected');
select pg_temp.assert_true(public.verify_account_email_worker((select decrypted_secret from vault.decrypted_secrets where name='koc_account_email_worker')),'valid server credential accepted');
select pg_temp.assert_true((select count(*)=1 from cron.job where jobname='koc-account-email-delivery' and schedule='*/15 * * * *'),'delivery scheduled');
rollback;
