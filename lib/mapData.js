import { companies as fallbackCompanies, seedReviews } from './data';

export function mapCompanyRow(row) {
  if (!row) return null;
  const metrics = {
    'Work-Life Balance': Number(row.work_life_balance ?? 0),
    Management: Number(row.management ?? 0),
    'Office Politics': Number(row.office_politics ?? 0),
    Compensation: Number(row.compensation ?? 0)
  };
  const populated = Object.values(metrics).filter((v) => v > 0);
  const score = Number(row.score ?? (populated.length ? populated.reduce((a,b)=>a+b,0)/populated.length : 0));
  const reviews = Number(row.review_count ?? 0);
  const employees = Number(row.verified_employee_count ?? 0);
  const location = [row.hq_city, row.hq_country].filter(Boolean).join(', ') || 'Global';
  const issues = Array.isArray(row.ai_themes) && row.ai_themes.length ? row.ai_themes : [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logo: row.name?.slice(0, 1)?.toUpperCase() || '?',
    domain: row.domain,
    domains: row.domains || [],
    website: row.website,
    sector: row.industry || 'Company',
    location,
    score,
    reviews,
    employees,
    rank: reviews ? 'Based on LinkedOut reviews' : 'New page',
    trend: 0,
    metrics,
    issues,
    positives: row.ai_positives || [],
    concerns: row.ai_concerns || [],
    summary: row.ai_summary || (reviews ? 'AI summary is being refreshed from published employee experiences.' : 'No published employee experiences yet. This company page is ready for verified employees to add context.')
  };
}

export function mapReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user: row.pseudonym,
    verified: Boolean(row.employment_verified),
    company: row.company_name,
    companySlug: row.company_slug,
    role: row.role_title || 'Employee',
    department: row.department || '',
    tenure: row.tenure_label || (row.employment_status === 'former' ? 'Former employee' : 'Current employee'),
    location: row.location || '',
    time: formatAge(row.published_at || row.created_at),
    body: row.body,
    tags: row.tags || [],
    votes: Number(row.vote_score || 0),
    comments: Number(row.comment_count || 0),
    ratings: {
      workLifeBalance: row.work_life_balance,
      management: row.management,
      officePolitics: row.office_politics,
      compensation: row.compensation
    }
  };
}

function formatAge(date) {
  if (!date) return 'now';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60_000) return 'now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(date).toLocaleDateString();
}

export function fallbackCompanyList() { return fallbackCompanies; }
export function fallbackReviewList() { return seedReviews; }
