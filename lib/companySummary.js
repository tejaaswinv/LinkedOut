import { aiJson } from './ai';

export async function generateCompanySummary(company, reviews) {
  if (!reviews?.length) {
    return {
      summary: 'Not enough published employee experiences yet to generate a reliable summary.',
      positives: [],
      concerns: [],
      themes: []
    };
  }

  const compactReviews = reviews.slice(0, 50).map((r) => ({
    role: r.role_title,
    department: r.department,
    location: r.location,
    employment_status: r.employment_status,
    text: r.body,
    tags: r.tags,
    ratings: {
      work_life_balance: r.work_life_balance,
      management: r.management,
      office_politics: r.office_politics,
      compensation: r.compensation
    }
  }));

  const system = `You create balanced workplace-intelligence summaries for LinkedOut.
Summarize patterns across employee reviews. Treat reviews as subjective reports, not verified facts.
Never identify individual employees. Avoid legal conclusions. Use language such as "reviewers report", "recurring themes include", and "some reviewers describe".
Return strict JSON with: summary (2-3 sentences, <=90 words), positives (array max 5), concerns (array max 5), themes (array max 8).`;

  const result = await aiJson({
    system,
    user: JSON.stringify({ company: company.name, industry: company.industry, reviews: compactReviews }),
    temperature: 0.2,
    maxTokens: 1000
  });

  if (!result) return null;
  return {
    summary: String(result.summary || '').slice(0, 1200),
    positives: Array.isArray(result.positives) ? result.positives.slice(0, 5).map(String) : [],
    concerns: Array.isArray(result.concerns) ? result.concerns.slice(0, 5).map(String) : [],
    themes: Array.isArray(result.themes) ? result.themes.slice(0, 8).map(String) : []
  };
}
