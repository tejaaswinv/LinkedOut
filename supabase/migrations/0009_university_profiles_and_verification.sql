create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  domain text,
  domains text[] not null default '{}',
  website text,
  city text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.universities enable row level security;
drop policy if exists "universities public read" on public.universities;
create policy "universities public read" on public.universities for select using (true);
grant select on public.universities to anon, authenticated;

alter table public.profiles
  add column if not exists current_university_id uuid references public.universities(id) on delete set null,
  add column if not exists field_of_study text,
  add column if not exists graduation_year smallint,
  add column if not exists show_university boolean not null default true,
  add column if not exists show_field_of_study boolean not null default true,
  add column if not exists show_graduation_year boolean not null default false;

alter table public.profiles drop constraint if exists profiles_graduation_year_check;
alter table public.profiles add constraint profiles_graduation_year_check
  check (graduation_year is null or graduation_year between 1950 and 2100);

create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  method text not null default 'university_email' check (method in ('university_email','manual')),
  student_email_hash text,
  student_email_domain text,
  email_fingerprint_version smallint,
  field_of_study text,
  graduation_year smallint,
  code_hash text,
  code_sent_at timestamptz,
  code_expires_at timestamptz,
  attempts integer not null default 0,
  verified_at timestamptz,
  verified_until timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_verifications enable row level security;
revoke all on public.student_verifications from anon, authenticated;

create index if not exists student_verifications_user_university_idx
  on public.student_verifications(user_id, university_id, status);
create index if not exists student_verifications_recent_attempts_idx
  on public.student_verifications(user_id, university_id, created_at desc);
create unique index if not exists student_verifications_unique_verified_email
  on public.student_verifications(student_email_hash)
  where status = 'verified' and student_email_hash is not null;

create index if not exists universities_name_idx
  on public.universities using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(country,'') || ' ' || coalesce(city,'')));

drop trigger if exists universities_touch_updated_at on public.universities;
create trigger universities_touch_updated_at before update on public.universities
for each row execute procedure public.touch_updated_at();

drop trigger if exists student_verifications_touch_updated_at on public.student_verifications;
create trigger student_verifications_touch_updated_at before update on public.student_verifications
for each row execute procedure public.touch_updated_at();

comment on table public.student_verifications is 'Private proof that a pseudonymous LinkedOut account controls an email at a recognized university.';
comment on column public.student_verifications.student_email_hash is 'Keyed HMAC fingerprint of the normalized university email. Never store the plaintext email.';

insert into public.universities (slug,name,domain,domains,website,city,country) values
  ('sutd','Singapore University of Technology and Design','sutd.edu.sg',array['sutd.edu.sg'],'https://www.sutd.edu.sg','Singapore','Singapore'),
  ('nus','National University of Singapore','nus.edu.sg',array['nus.edu.sg'],'https://www.nus.edu.sg','Singapore','Singapore'),
  ('ntu-singapore','Nanyang Technological University','ntu.edu.sg',array['ntu.edu.sg'],'https://www.ntu.edu.sg','Singapore','Singapore'),
  ('smu-singapore','Singapore Management University','smu.edu.sg',array['smu.edu.sg'],'https://www.smu.edu.sg','Singapore','Singapore'),
  ('sit-singapore','Singapore Institute of Technology','singaporetech.edu.sg',array['singaporetech.edu.sg'],'https://www.singaporetech.edu.sg','Singapore','Singapore'),
  ('suss','Singapore University of Social Sciences','suss.edu.sg',array['suss.edu.sg'],'https://www.suss.edu.sg','Singapore','Singapore'),
  ('harvard','Harvard University','harvard.edu',array['harvard.edu'],'https://www.harvard.edu','Cambridge','United States'),
  ('mit','Massachusetts Institute of Technology','mit.edu',array['mit.edu'],'https://www.mit.edu','Cambridge','United States'),
  ('stanford','Stanford University','stanford.edu',array['stanford.edu'],'https://www.stanford.edu','Stanford','United States'),
  ('uc-berkeley','University of California, Berkeley','berkeley.edu',array['berkeley.edu'],'https://www.berkeley.edu','Berkeley','United States'),
  ('oxford','University of Oxford','ox.ac.uk',array['ox.ac.uk'],'https://www.ox.ac.uk','Oxford','United Kingdom'),
  ('cambridge','University of Cambridge','cam.ac.uk',array['cam.ac.uk'],'https://www.cam.ac.uk','Cambridge','United Kingdom'),
  ('iit-madras','Indian Institute of Technology Madras','iitm.ac.in',array['iitm.ac.in','smail.iitm.ac.in'],'https://www.iitm.ac.in','Chennai','India'),
  ('iit-bombay','Indian Institute of Technology Bombay','iitb.ac.in',array['iitb.ac.in'],'https://www.iitb.ac.in','Mumbai','India'),
  ('iit-delhi','Indian Institute of Technology Delhi','iitd.ac.in',array['iitd.ac.in'],'https://www.iitd.ac.in','New Delhi','India'),
  ('bits-pilani','BITS Pilani','bits-pilani.ac.in',array['bits-pilani.ac.in'],'https://www.bits-pilani.ac.in','Pilani','India'),
  ('zhejiang-university','Zhejiang University','zju.edu.cn',array['zju.edu.cn'],'https://www.zju.edu.cn','Hangzhou','China'),
  ('tsinghua','Tsinghua University','tsinghua.edu.cn',array['tsinghua.edu.cn'],'https://www.tsinghua.edu.cn','Beijing','China'),
  ('peking-university','Peking University','pku.edu.cn',array['pku.edu.cn'],'https://www.pku.edu.cn','Beijing','China'),
  ('hkust','Hong Kong University of Science and Technology','ust.hk',array['ust.hk'],'https://hkust.edu.hk','Hong Kong','Hong Kong')
on conflict (slug) do update set
  name=excluded.name, domain=excluded.domain, domains=excluded.domains, website=excluded.website, city=excluded.city, country=excluded.country, updated_at=now();
