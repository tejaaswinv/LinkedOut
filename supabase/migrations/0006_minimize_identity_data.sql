-- Login email remains solely with Firebase Auth. LinkedOut only stores the
-- opaque Firebase UID -> internal UUID mapping plus email-verification state.
alter table public.app_users drop column if exists email_hash;
