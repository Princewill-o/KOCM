-- Operational usage counters only. No prompts, responses, real IPs or account IDs.
create table private.grace_chat_usage (
 bucket text not null,
 window_start timestamptz not null,
 requests integer not null check(requests > 0),
 primary key(bucket,window_start)
);
alter table private.grace_chat_usage enable row level security;
revoke all on private.grace_chat_usage from public, anon, authenticated;

create function public.claim_grace_chat(p_identity text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
 v_now timestamptz := clock_timestamp();
 v_day timestamptz := date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';
 v_minute timestamptz := date_trunc('minute',v_now);
begin
 if p_identity is null or p_identity !~ '^[a-f0-9]{64}$' then raise exception 'Invalid Grace identity'; end if;
 -- One global lock serializes checks and claims across concurrent Edge workers.
 perform pg_catalog.pg_advisory_xact_lock(728103291);
 delete from private.grace_chat_usage where window_start < v_day - interval '2 days';
 if coalesce((select requests from private.grace_chat_usage where bucket='global-day' and window_start=v_day),0)>=100
 or coalesce((select requests from private.grace_chat_usage where bucket='global-minute' and window_start=v_minute),0)>=2
 or coalesce((select requests from private.grace_chat_usage where bucket='client-'||p_identity and window_start=v_day),0)>=10 then return false; end if;
 insert into private.grace_chat_usage(bucket,window_start,requests) values
 ('global-day',v_day,1),('global-minute',v_minute,1),('client-'||p_identity,v_day,1)
 on conflict(bucket,window_start) do update set requests=private.grace_chat_usage.requests+1;
 return true;
end $$;
revoke all on function public.claim_grace_chat(text) from public, anon, authenticated;
grant execute on function public.claim_grace_chat(text) to service_role;
