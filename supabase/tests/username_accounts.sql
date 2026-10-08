begin;
do $$
declare campus uuid; me uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); r public.profiles; hash text:=repeat('e',64); i integer;
begin
 if has_function_privilege('anon','public.resolve_username_login(text)','execute') or has_function_privilege('authenticated','public.resolve_username_login(text)','execute') or has_function_privilege('authenticated','public.assign_pending_username(uuid,text,uuid)','execute') or has_function_privilege('anon','public.claim_username_auth(text,text)','execute') then raise exception 'Private username auth RPC exposed';end if;
 select id into campus from public.campuses where is_active limit 1;
 insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values(me,me::text||'@accounts.kocm.invalid',jsonb_build_object('full_name','Username Test','campus_id',campus),now()),(other_user,other_user::text||'@accounts.kocm.invalid',jsonb_build_object('full_name','Other Test','campus_id',campus),now());
 perform public.assign_pending_username(me,'campus_test',campus);
 if public.resolve_username_login('CAMPUS_TEST') is distinct from me::text||'@accounts.kocm.invalid' then raise exception 'Username lookup failed';end if;
 begin perform public.assign_pending_username(other_user,'campus_test',campus);raise exception 'Duplicate accepted';exception when unique_violation then null;end;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 r:=public.update_my_username(' Other_Test ');if r.id<>other_user or r.username<>'other_test' then raise exception 'Self update failed';end if;
 if (select username from public.profiles where id=me)<>'campus_test' then raise exception 'Other profile changed';end if;
 begin perform public.update_my_username('bad@name');raise exception 'Invalid accepted';exception when sqlstate '22023' then null;end;
 update public.profiles set status='rejected' where id=me;
 if exists(select 1 from private.account_email_deliveries where user_id=me) then raise exception 'Internal alias queued';end if;
 for i in 1..5 loop if not public.claim_username_auth(hash,'signup') then raise exception 'Allowed signup rejected';end if;end loop;
 if public.claim_username_auth(hash,'signup') then raise exception 'Signup hourly quota exceeded';end if;
end $$;
rollback;
