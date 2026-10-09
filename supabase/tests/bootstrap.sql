-- Minimal Supabase stubs for a NEW disposable local PostgreSQL database only.
do $$ begin if current_database() !~ '^koc_workflow_test_[a-f0-9]+$' then raise exception 'Refusing bootstrap outside disposable test database'; end if; end $$;
create schema auth; create schema storage;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,email_change text,email_change_token_new text,email_change_token_current text,updated_at timestamptz);
create table auth.identities(user_id uuid,provider text,identity_data jsonb,updated_at timestamptz);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth,storage to authenticated,anon;
grant select,insert,delete on storage.objects to authenticated;

do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;

-- Isolated local scheduler/Vault stubs never call a live endpoint.
create schema vault; create schema cron; create schema net;
create table vault.decrypted_secrets(id uuid default gen_random_uuid(),name text,decrypted_secret text);
create function vault.create_secret(text,text,text) returns uuid language plpgsql as $$ declare key uuid:=gen_random_uuid(); begin insert into vault.decrypted_secrets(id,name,decrypted_secret) values(key,$2,$1);return key;end $$;
create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,active boolean default true);
create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ declare key bigint; begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid into key;return key;end $$;
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$ select 1::bigint $$;
