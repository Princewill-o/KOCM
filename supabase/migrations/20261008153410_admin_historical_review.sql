-- Historical review figures are private admin data, not bundled browser assets.
create table public.admin_historical_reviews(
 id text primary key,
 source_name text not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and jsonb_typeof(payload->'rows')='array' and jsonb_typeof(payload->'overall')='array' and jsonb_typeof(payload->'attendanceTrend')='array'),
 created_at timestamptz not null default now()
);
alter table public.admin_historical_reviews enable row level security;
create policy admin_historical_reviews_read on public.admin_historical_reviews for select to authenticated using ((select private.my_role())='admin');
revoke all on public.admin_historical_reviews from public,anon,authenticated;
grant select on public.admin_historical_reviews to authenticated;
