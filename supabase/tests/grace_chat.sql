begin;
do $$
declare v_identity text := repeat('a',64); v_day timestamptz := date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
begin
 if has_function_privilege('anon','public.claim_grace_chat(text)','execute') or has_function_privilege('authenticated','public.claim_grace_chat(text)','execute') then raise exception 'Grace RPC exposed to browser'; end if;
 if not has_function_privilege('service_role','public.claim_grace_chat(text)','execute') then raise exception 'Grace worker lacks claim access'; end if;
 if not public.claim_grace_chat(v_identity) or not public.claim_grace_chat(v_identity) then raise exception 'First claims rejected'; end if;
 if public.claim_grace_chat(v_identity) then raise exception 'Global minute allowance exceeded'; end if;
 delete from private.grace_chat_usage where bucket='global-minute';
 update private.grace_chat_usage set requests=10 where bucket='client-'||v_identity;
 if public.claim_grace_chat(v_identity) then raise exception 'Client daily allowance exceeded'; end if;
 update private.grace_chat_usage set requests=100 where bucket='global-day';
 if public.claim_grace_chat(repeat('b',64)) then raise exception 'Global daily allowance exceeded'; end if;
 if exists(select 1 from private.grace_chat_usage where bucket='client-'||repeat('b',64)) then raise exception 'Rejected identity persisted'; end if;
end $$;
rollback;
