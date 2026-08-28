-- LinkedOut production schema
-- Run this in a new Supabase project via the SQL editor or Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  domain text,
  domains text[] not null default '{}',
  website text,
  industry text,
  hq_city text,
  hq_country text,
  description text,
  aliases text[] not null default '{}',
  source text not null default 'seed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(industry,'') || ' ' || coalesce(hq_country,'')));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  bio text,
  current_company_id uuid references public.companies(id) on delete set null,
  position text,
  department text,
  location text,
  employment_status text check (employment_status in ('current','former','between_roles','student','other')),
  identity_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employment_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  method text not null check (method in ('work_email','document','manual')),
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  work_email_hash text,
  work_email_domain text,
  role_title text,
  department text,
  location text,
  employment_status text check (employment_status in ('current','former')),
  start_date date,
  end_date date,
  code_hash text,
  code_expires_at timestamptz,
  attempts integer not null default 0,
  evidence_path text,
  verified_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employment_verifications_user_company_idx on public.employment_verifications(user_id, company_id, status);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  verification_id uuid references public.employment_verifications(id) on delete set null,
  pseudonym text not null,
  employment_verified boolean not null default false,
  role_title text,
  department text,
  location text,
  employment_status text check (employment_status in ('current','former')),
  tenure_label text,
  body text not null,
  tags text[] not null default '{}',
  work_life_balance smallint check (work_life_balance between 1 and 5),
  management smallint check (management between 1 and 5),
  office_politics smallint check (office_politics between 1 and 5),
  compensation smallint check (compensation between 1 and 5),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  moderation_source text,
  moderation_reason text,
  moderation_flags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_company_published_idx on public.reviews(company_id, published_at desc) where moderation_status = 'approved';
create index if not exists reviews_user_idx on public.reviews(user_id, created_at desc);

create table if not exists public.review_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table if not exists public.moderation_events (
  id bigserial primary key,
  review_id uuid references public.reviews(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  decision text not null,
  source text not null,
  reason text,
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.company_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  summary text not null,
  positives text[] not null default '{}',
  concerns text[] not null default '{}',
  themes text[] not null default '{}',
  review_count integer not null default 0,
  generated_at timestamptz not null default now(),
  unique(company_id)
);

create or replace view public.company_public_stats as
select
  c.id,
  c.slug,
  c.name,
  c.legal_name,
  c.domain,
  c.domains,
  c.website,
  c.industry,
  c.hq_city,
  c.hq_country,
  c.description,
  c.aliases,
  count(r.id) filter (where r.moderation_status = 'approved')::int as review_count,
  count(distinct r.user_id) filter (where r.moderation_status = 'approved' and r.employment_verified)::int as verified_employee_count,
  round(avg((coalesce(r.work_life_balance,0) + coalesce(r.management,0) + coalesce(r.office_politics,0) + coalesce(r.compensation,0))::numeric / nullif(
    (case when r.work_life_balance is not null then 1 else 0 end +
     case when r.management is not null then 1 else 0 end +
     case when r.office_politics is not null then 1 else 0 end +
     case when r.compensation is not null then 1 else 0 end), 0
  )) filter (where r.moderation_status = 'approved'), 2) as score,
  round(avg(r.work_life_balance) filter (where r.moderation_status = 'approved'), 2) as work_life_balance,
  round(avg(r.management) filter (where r.moderation_status = 'approved'), 2) as management,
  round(avg(r.office_politics) filter (where r.moderation_status = 'approved'), 2) as office_politics,
  round(avg(r.compensation) filter (where r.moderation_status = 'approved'), 2) as compensation,
  s.summary as ai_summary,
  s.positives as ai_positives,
  s.concerns as ai_concerns,
  s.themes as ai_themes,
  s.generated_at as summary_generated_at
from public.companies c
left join public.reviews r on r.company_id = c.id
left join public.company_summaries s on s.company_id = c.id
group by c.id, s.summary, s.positives, s.concerns, s.themes, s.generated_at;

-- Auto-create a private profile for every authenticated account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  desired_username text;
begin
  desired_username := coalesce(nullif(new.raw_user_meta_data->>'username',''), '@user_' || substr(new.id::text, 1, 8));
  begin
    insert into public.profiles (id, username, identity_verified_at)
    values (new.id, desired_username, case when new.email_confirmed_at is not null then now() else null end);
  exception when unique_violation then
    insert into public.profiles (id, username, identity_verified_at)
    values (new.id, '@user_' || replace(substr(new.id::text, 1, 12), '-', ''), case when new.email_confirmed_at is not null then now() else null end);
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep updated_at automatic on mutable tables.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at before update on public.companies for each row execute procedure public.touch_updated_at();
drop trigger if exists verifications_touch_updated_at on public.employment_verifications;
create trigger verifications_touch_updated_at before update on public.employment_verifications for each row execute procedure public.touch_updated_at();
drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at before update on public.reviews for each row execute procedure public.touch_updated_at();

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.employment_verifications enable row level security;
alter table public.reviews enable row level security;
alter table public.review_votes enable row level security;
alter table public.moderation_events enable row level security;
alter table public.company_summaries enable row level security;

-- Companies and aggregate summaries can be read publicly.
drop policy if exists "companies public read" on public.companies;
create policy "companies public read" on public.companies for select using (true);
drop policy if exists "company summaries public read" on public.company_summaries;
create policy "company summaries public read" on public.company_summaries for select using (true);

-- Profiles are private at the table level; public profile shaping happens in server API routes.
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Employment proof is visible only to its owner. Server moderation/verification uses service role.
drop policy if exists "verifications read own" on public.employment_verifications;
create policy "verifications read own" on public.employment_verifications for select using (auth.uid() = user_id);

-- Users can inspect their own submitted reviews, including moderation state.
drop policy if exists "reviews read own" on public.reviews;
create policy "reviews read own" on public.reviews for select using (auth.uid() = user_id);

-- Votes are private per user; API exposes only aggregate counts.
drop policy if exists "votes read own" on public.review_votes;
create policy "votes read own" on public.review_votes for select using (auth.uid() = user_id);
drop policy if exists "votes insert own" on public.review_votes;
create policy "votes insert own" on public.review_votes for insert with check (auth.uid() = user_id);
drop policy if exists "votes update own" on public.review_votes;
create policy "votes update own" on public.review_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "votes delete own" on public.review_votes;
create policy "votes delete own" on public.review_votes for delete using (auth.uid() = user_id);

-- Do not grant clients direct access to sensitive review/moderation columns.
revoke select, insert, update, delete on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;
revoke all on public.moderation_events from anon, authenticated;
revoke insert, update, delete on public.employment_verifications from anon, authenticated;
revoke all on public.company_public_stats from anon, authenticated;

grant select on public.companies to anon, authenticated;
grant select on public.company_summaries to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.employment_verifications to authenticated;
grant select on public.reviews to authenticated;
grant select, insert, update, delete on public.review_votes to authenticated;

-- Private storage for former-employee/manual employment proof. All access is through service-role API routes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employment-evidence', 'employment-evidence', false, 8388608, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
