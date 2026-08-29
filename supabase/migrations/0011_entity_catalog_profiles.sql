-- Rich public catalog metadata for university and company pages.
-- Ranking fields are intentionally source-neutral: populate them only from data
-- that LinkedOut is licensed or otherwise permitted to republish.

alter table public.universities
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists institution_type text,
  add column if not exists founded_year smallint,
  add column if not exists ror_id text,
  add column if not exists wikidata_id text,
  add column if not exists wikipedia_url text,
  add column if not exists ranking_provider text,
  add column if not exists ranking_year smallint,
  add column if not exists ranking_position integer,
  add column if not exists ranking_display text,
  add column if not exists ranking_score numeric(6,2),
  add column if not exists ranking_source_url text,
  add column if not exists metadata_sources jsonb not null default '{}'::jsonb,
  add column if not exists last_enriched_at timestamptz;

alter table public.companies
  add column if not exists logo_url text,
  add column if not exists founded_year smallint,
  add column if not exists wikidata_id text,
  add column if not exists wikipedia_url text,
  add column if not exists ticker text,
  add column if not exists exchange text,
  add column if not exists employee_count bigint,
  add column if not exists revenue_usd numeric(20,2),
  add column if not exists ranking_provider text,
  add column if not exists ranking_year smallint,
  add column if not exists ranking_position integer,
  add column if not exists ranking_source_url text,
  add column if not exists metadata_sources jsonb not null default '{}'::jsonb,
  add column if not exists last_enriched_at timestamptz;

create index if not exists universities_ranking_idx
  on public.universities (ranking_provider, ranking_year desc, ranking_position asc)
  where ranking_position is not null;
create index if not exists universities_ror_idx
  on public.universities (ror_id)
  where ror_id is not null;
create index if not exists companies_ranking_idx
  on public.companies (ranking_provider, ranking_year desc, ranking_position asc)
  where ranking_position is not null;
create index if not exists companies_wikidata_idx
  on public.companies (wikidata_id)
  where wikidata_id is not null;

create or replace view public.company_public_stats
with (security_invoker = true)
as
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
  count(r.id) filter (where r.moderation_status = 'approved')::integer as review_count,
  count(distinct r.pseudonym) filter (where r.moderation_status = 'approved' and r.employment_verified)::integer as verified_employee_count,
  round(avg((coalesce(r.work_life_balance::integer, 0) + coalesce(r.management::integer, 0) + coalesce(r.office_politics::integer, 0) + coalesce(r.compensation::integer, 0))::numeric /
    nullif((case when r.work_life_balance is not null then 1 else 0 end +
            case when r.management is not null then 1 else 0 end +
            case when r.office_politics is not null then 1 else 0 end +
            case when r.compensation is not null then 1 else 0 end), 0)::numeric)
    filter (where r.moderation_status = 'approved'), 2) as score,
  round(avg(r.work_life_balance) filter (where r.moderation_status = 'approved'), 2) as work_life_balance,
  round(avg(r.management) filter (where r.moderation_status = 'approved'), 2) as management,
  round(avg(r.office_politics) filter (where r.moderation_status = 'approved'), 2) as office_politics,
  round(avg(r.compensation) filter (where r.moderation_status = 'approved'), 2) as compensation,
  s.summary as ai_summary,
  s.positives as ai_positives,
  s.concerns as ai_concerns,
  s.themes as ai_themes,
  s.generated_at as summary_generated_at,
  c.source,
  c.logo_url,
  c.founded_year,
  c.wikidata_id,
  c.wikipedia_url,
  c.ticker,
  c.exchange,
  c.employee_count,
  c.revenue_usd,
  c.ranking_provider,
  c.ranking_year,
  c.ranking_position,
  c.ranking_source_url,
  c.metadata_sources,
  c.last_enriched_at
from public.companies c
left join public.reviews r on r.company_id = c.id
left join public.company_summaries s on s.company_id = c.id
group by c.id, s.summary, s.positives, s.concerns, s.themes, s.generated_at;
