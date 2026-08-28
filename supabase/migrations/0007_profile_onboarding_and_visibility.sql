alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists show_company boolean not null default true,
  add column if not exists show_position boolean not null default true,
  add column if not exists show_department boolean not null default false,
  add column if not exists show_location boolean not null default true;

comment on column public.profiles.onboarding_completed_at is 'Set after the user completes the LinkedOut pseudonymous profile onboarding flow.';
comment on column public.profiles.show_company is 'Whether the profile UI may display the selected company publicly.';
comment on column public.profiles.show_position is 'Whether the profile UI may display the position publicly.';
comment on column public.profiles.show_department is 'Whether the profile UI may display the department publicly.';
comment on column public.profiles.show_location is 'Whether the profile UI may display the location publicly.';
