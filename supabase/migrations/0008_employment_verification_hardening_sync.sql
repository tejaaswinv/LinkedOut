alter table public.employment_verifications
  add column if not exists code_sent_at timestamptz,
  add column if not exists verified_until timestamptz,
  add column if not exists evidence_deleted_at timestamptz,
  add column if not exists work_email_fingerprint_version smallint;

create index if not exists employment_verifications_recent_attempts_idx
  on public.employment_verifications(user_id, company_id, method, created_at desc);

create index if not exists employment_verifications_valid_idx
  on public.employment_verifications(user_id, company_id, status, verified_until);

create unique index if not exists employment_verifications_unique_verified_work_email
  on public.employment_verifications(work_email_hash)
  where method = 'work_email' and status = 'verified' and work_email_hash is not null;

comment on column public.employment_verifications.work_email_hash is
  'Keyed HMAC fingerprint of the normalized work email. Never store the plaintext work email here.';
comment on column public.employment_verifications.verified_until is
  'Expiry for time-sensitive employment verification. NULL is used for historical/former employment verification.';
comment on column public.employment_verifications.evidence_deleted_at is
  'Timestamp when uploaded employment evidence was removed from private storage after moderation.';
