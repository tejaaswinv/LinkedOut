create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email_hash text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.employment_verifications drop constraint if exists employment_verifications_user_id_fkey;
alter table public.reviews drop constraint if exists reviews_user_id_fkey;
alter table public.review_votes drop constraint if exists review_votes_user_id_fkey;
alter table public.moderation_events drop constraint if exists moderation_events_user_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references public.app_users(id) on delete cascade;
alter table public.employment_verifications
  add constraint employment_verifications_user_id_fkey foreign key (user_id) references public.app_users(id) on delete cascade;
alter table public.reviews
  add constraint reviews_user_id_fkey foreign key (user_id) references public.app_users(id) on delete cascade;
alter table public.review_votes
  add constraint review_votes_user_id_fkey foreign key (user_id) references public.app_users(id) on delete cascade;
alter table public.moderation_events
  add constraint moderation_events_user_id_fkey foreign key (user_id) references public.app_users(id) on delete set null;

drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "verifications read own" on public.employment_verifications;
drop policy if exists "reviews read own" on public.reviews;
drop policy if exists "votes read own" on public.review_votes;
drop policy if exists "votes insert own" on public.review_votes;
drop policy if exists "votes update own" on public.review_votes;
drop policy if exists "votes delete own" on public.review_votes;

drop policy if exists "reviews public approved" on public.reviews;
create policy "reviews public approved" on public.reviews
  for select to anon, authenticated
  using (moderation_status = 'approved');

create or replace function public.touch_app_users_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at
before update on public.app_users
for each row execute procedure public.touch_app_users_updated_at();
