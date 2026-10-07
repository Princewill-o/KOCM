-- A campus is a reporting entity; a leader is a separately authenticated person.
-- Stop migration rather than arbitrarily revoking duplicate existing leaders.
create unique index profiles_one_active_campus_lead on public.profiles(campus_id)
where role='campus' and status='active';

alter table public.profiles
 add column phone text,
 add column course text,
 add column study_year smallint,
 add column bio text,
 add constraint profiles_phone_length check(phone is null or (char_length(phone)<=40 and phone ~ '^\+?[0-9 ()-]{7,40}$' and char_length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 15)),
 add constraint profiles_course_length check(course is null or char_length(course)<=120),
 add constraint profiles_study_year_range check(study_year is null or study_year between 1 and 10),
 add constraint profiles_bio_length check(bio is null or char_length(bio)<=1000);

-- The unique index is the race-safe authority. This trigger also gives a clear
-- error for ordinary assignment conflicts through checked admin writes.
create function private.check_campus_lead_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role='campus' and new.status='active' and exists(
  select 1 from public.profiles where role='campus' and status='active' and campus_id=new.campus_id and id<>new.id
 ) then raise exception 'This university already has an active campus lead. Reassign or deactivate that lead first.' using errcode='23505'; end if;
 return new;
end $$;
revoke all on function private.check_campus_lead_assignment() from public,anon,authenticated;
create trigger profiles_check_campus_lead before insert or update of role,status,campus_id on public.profiles
for each row execute function private.check_campus_lead_assignment();

-- No arbitrary user ID parameter; auth.uid() determines the only writable row.
-- Browser column grants remain unchanged, preventing direct writes of details.
create function public.update_my_profile(p_full_name text,p_phone text default null,p_course text default null,p_study_year integer default null,p_bio text default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare me public.profiles; v_name text:=trim(coalesce(p_full_name,''));v_phone text:=nullif(trim(p_phone),'');v_course text:=nullif(trim(p_course),'');v_bio text:=nullif(trim(p_bio),'');
begin
 if auth.uid() is null then raise exception 'Sign in to update your profile.' using errcode='42501';end if;
 if char_length(v_name) not between 2 and 100 then raise exception 'Use between 2 and 100 characters for your name.' using errcode='22023';end if;
 if v_phone is not null and (char_length(v_phone)>40 or v_phone !~ '^\+?[0-9 ()-]{7,40}$' or char_length(regexp_replace(v_phone,'[^0-9]','','g')) not between 7 and 15) then raise exception 'Enter a phone number with 7 to 15 digits, or leave it blank.' using errcode='22023';end if;
 if char_length(v_course)>120 then raise exception 'Keep your course within 120 characters.' using errcode='22023';end if;
 if p_study_year is not null and p_study_year not between 1 and 10 then raise exception 'Choose a study year from 1 to 10, or leave it blank.' using errcode='22023';end if;
 if char_length(v_bio)>1000 then raise exception 'Keep your biography within 1000 characters.' using errcode='22023';end if;
 update public.profiles set full_name=v_name,phone=v_phone,course=v_course,study_year=p_study_year,bio=v_bio where id=auth.uid() returning * into me;
 if me.id is null then raise exception 'Account not found.' using errcode='22023';end if;
 return me;
end $$;
revoke all on function public.update_my_profile(text,text,text,integer,text) from public,anon;
grant execute on function public.update_my_profile(text,text,text,integer,text) to authenticated;

-- Contact details are not exposed to ordinary members or editors through this
-- directory. An active administrator may review leaders on all active campuses.
create function public.campus_lead_profiles()
returns table(campus_id uuid,campus_name text,region text,latitude double precision,longitude double precision,meeting_info text,address text,cluster_name text,lead_id uuid,lead_name text,lead_email text,lead_phone text,lead_course text,lead_year integer,lead_bio text)
language plpgsql security definer set search_path='' as $$
begin
 if (select private.my_role()) is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 return query select c.id,c.name::text,c.region::text,c.latitude::double precision,c.longitude::double precision,c.meeting_info,c.address,cl.name::text,p.id,p.full_name::text,p.email::text,p.phone,p.course,p.study_year::integer,p.bio
 from public.campuses c left join public.clusters cl on cl.id=c.cluster_id
 left join public.profiles p on p.campus_id=c.id and p.role='campus' and p.status='active'
 where c.is_active order by c.name;
end $$;
revoke all on function public.campus_lead_profiles() from public,anon;
grant execute on function public.campus_lead_profiles() to authenticated;
