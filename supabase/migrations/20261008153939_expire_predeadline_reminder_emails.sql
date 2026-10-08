-- Follow-up for projects which already applied the initial reminder migration.
-- PL/pgSQL callers resolve the new defaulted signature on their next invocation.
-- Fresh checkouts may already have the two-argument helper; both states work.
drop function if exists private.report_email_current(private.account_email_deliveries);
create or replace function private.report_email_current(q private.account_email_deliveries,p_now timestamptz default now()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=q.user_id and p.status='active' and p.email=q.recipient and lower(u.email)=lower(p.email) and u.email_confirmed_at is not null and private.is_real_reporting_email(p.email)
 and ((q.payload->>'scope'='campus' and p.role='campus' and p.campus_id=(q.payload->>'scopeId')::uuid) or (q.payload->>'scope'='cluster' and p.role='cluster' and p.cluster_id=(q.payload->>'scopeId')::uuid)))
 and exists(select 1 from public.seasons s where s.id=q.payload->>'seasonId' and s.is_current and (q.payload->>'weekEnding')::date between s.start_date and s.end_date and (q.kind<>'report_reminder' or p_now<(((q.payload->>'weekEnding')::date::timestamp+make_interval(hours=>s.deadline_hour)) at time zone s.time_zone)))
 and (q.payload->>'weekEnding')::date=((p_now at time zone 'Europe/London')::date+((5-extract(isodow from p_now at time zone 'Europe/London')::int+7)%7))
 and private.report_task_missing(q.payload->>'scope',(q.payload->>'scopeId')::uuid,(q.payload->>'weekEnding')::date,q.payload->>'seasonId')
$$;
revoke all on function private.report_email_current(private.account_email_deliveries,timestamptz) from public,anon,authenticated;
