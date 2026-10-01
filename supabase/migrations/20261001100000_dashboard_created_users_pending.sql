-- Users created without a university (e.g. from the Supabase dashboard) wait as pending
-- stats editors until an administrator sets their role on the Accounts page.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := new.raw_app_meta_data ->> 'koc_role';
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_campus uuid;
  v_status text;
begin
  if v_role in ('admin', 'editor') then
    v_status := 'active';
  else
    begin
      v_campus := (new.raw_user_meta_data ->> 'campus_id')::uuid;
    exception when others then v_campus := null;
    end;
    if v_campus is not null and not exists (select 1 from public.campuses where id = v_campus and is_active) then
      raise exception 'Select an active university.';
    end if;
    v_role := case when v_campus is null then 'editor' else 'campus' end;
    v_status := 'pending';
  end if;
  insert into public.profiles (id, full_name, email, role, status, campus_id)
  values (new.id, left(v_name, 100), lower(new.email), v_role, v_status, v_campus);
  return new;
end $$;
