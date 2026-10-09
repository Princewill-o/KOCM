begin;
do $$
declare actor uuid:=gen_random_uuid(); pending_user uuid:=gen_random_uuid(); campus uuid; p public.profiles;
begin
 insert into auth.users(id,email,raw_app_meta_data) values(actor,'three-role-admin@example.test','{"koc_role":"admin"}'),(pending_user,'former-role@example.test','{"koc_role":"editor"}');
 select * into p from public.profiles where id=pending_user;
 if p.role<>'campus' or p.status<>'pending' or p.campus_id is not null then raise exception 'Removed metadata role gained authority';end if;
 if exists(select 1 from public.profiles where role='editor') then raise exception 'Removed role survives';end if;
 perform set_config('request.jwt.claim.sub',pending_user::text,true);
 if private.my_role() is not null then raise exception 'Pending unassigned has authority';end if;
 begin update public.profiles set role='editor' where id=pending_user;raise exception 'Removed role accepted';exception when check_violation then null;end;
 begin update public.profiles set status='active' where id=pending_user;raise exception 'Active campus without assignment';exception when check_violation then null;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.admin_update_user(pending_user,p_role=>'editor');raise exception 'RPC removed role accepted';exception when invalid_parameter_value then null;end;
 p:=public.admin_update_user(pending_user,p_role=>'campus',p_status=>'pending');
 select id into campus from public.campuses where is_active limit 1;
 p:=public.admin_update_user(pending_user,p_role=>'campus',p_status=>'active',p_campus_id=>campus);
 if p.role<>'campus' or p.campus_id<>campus then raise exception 'Campus assignment broken';end if;
 if exists(select 1 from pg_proc fn join pg_namespace ns on ns.oid=fn.pronamespace where ns.nspname in('public','private') and fn.prosrc like '%''editor''%') then raise exception 'Removed role still has function rights';end if;
 if exists(select 1 from pg_policies where schemaname in('public','storage') and (coalesce(qual,'')||coalesce(with_check,'')) like '%editor%') then raise exception 'Removed role still has policy rights';end if;
end $$;
rollback;
