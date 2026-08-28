import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient } from '../../../lib/supabase/public';
import { requireVerifiedUser } from '../../../lib/apiAuth';
import { createAdminClient } from '../../../lib/supabase/admin';
import { fallbackReviewList, mapReviewRow } from '../../../lib/mapData';
import { moderateReview } from '../../../lib/moderation';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  company: z.string().min(1),
  role: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).optional().default(''),
  location: z.string().trim().min(2).max(120),
  employmentStatus: z.enum(['current', 'former']).default('current'),
  tenure: z.string().trim().max(60).optional().default(''),
  body: z.string().trim().min(30).max(6000),
  tags: z.array(z.string().trim().min(1).max(50)).max(8).default([]),
  ratings: z.object({
    workLifeBalance: z.number().int().min(1).max(5),
    management: z.number().int().min(1).max(5),
    officePolitics: z.number().int().min(1).max(5),
    compensation: z.number().int().min(1).max(5)
  })
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const companySlug = (searchParams.get('company') || '').trim();
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
  const supabase = createPublicClient();

  if (!supabase) {
    let reviews = fallbackReviewList();
    if (companySlug) reviews = reviews.filter((r) => r.companySlug === companySlug);
    return NextResponse.json({ reviews: reviews.slice(0, limit), source: 'fallback' });
  }

  let companyId = null;
  if (companySlug) {
    const { data: company } = await supabase.from('companies').select('id').eq('slug', companySlug).maybeSingle();
    if (!company) return NextResponse.json({ reviews: [], source: 'supabase' });
    companyId = company.id;
  }

  let query = supabase
    .from('public_reviews')
    .select('id,company_id,pseudonym,employment_verified,role_title,department,location,employment_status,tenure_label,body,tags,work_life_balance,management,office_politics,compensation,published_at,created_at')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (companyId) query = query.eq('company_id', companyId);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ reviews: [], source: 'supabase' });

  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const reviewIds = rows.map((r) => r.id);
  const [{ data: companyRows }, { data: voteRows }] = await Promise.all([
    supabase.from('companies').select('id,slug,name').in('id', companyIds),
    supabase.from('review_vote_totals').select('review_id,vote_score').in('review_id', reviewIds)
  ]);

  const companies = Object.fromEntries((companyRows || []).map((c) => [c.id, c]));
  const votes = {};
  for (const v of voteRows || []) votes[v.review_id] = Number(v.vote_score || 0);

  const reviews = rows.map((row) => mapReviewRow({
    ...row,
    company_name: companies[row.company_id]?.name || 'Company',
    company_slug: companies[row.company_id]?.slug || '',
    vote_score: votes[row.id] || 0,
    comment_count: 0
  }));
  return NextResponse.json({ reviews, source: 'supabase' });
}

export async function POST(request) {
  const auth = await requireVerifiedUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = reviewSchema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid review.' }, { status: 400 }); }

  const [{ data: company }, { data: profile }] = await Promise.all([
    admin.from('companies').select('id,name').eq('slug', input.company).maybeSingle(),
    admin.from('profiles').select('username').eq('id', auth.user.id).maybeSingle()
  ]);
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const { data: verification } = await admin
    .from('employment_verifications')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('company_id', company.id)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: review, error } = await admin.from('reviews').insert({
    user_id: auth.user.id,
    company_id: company.id,
    verification_id: verification?.id || null,
    pseudonym: profile?.username || `@user_${auth.user.id.replace(/-/g,'').slice(0,10)}`,
    employment_verified: Boolean(verification),
    role_title: input.role,
    department: input.department || null,
    location: input.location,
    employment_status: input.employmentStatus,
    tenure_label: input.tenure || null,
    body: input.body,
    tags: input.tags,
    work_life_balance: input.ratings.workLifeBalance,
    management: input.ratings.management,
    office_politics: input.ratings.officePolitics,
    compensation: input.ratings.compensation,
    moderation_status: 'pending',
    moderation_source: 'firebase-api'
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const moderation = await moderateReview({
    body: input.body,
    companyName: company.name,
    roleTitle: input.role,
    location: input.location
  });

  const publishedAt = moderation.status === 'approved' ? new Date().toISOString() : null;
  await admin.from('reviews').update({
    body: moderation.safeText,
    moderation_status: moderation.status,
    moderation_source: moderation.source,
    moderation_reason: moderation.reason,
    moderation_flags: moderation.flags,
    published_at: publishedAt
  }).eq('id', review.id);

  await admin.from('moderation_events').insert({
    review_id: review.id,
    user_id: auth.user.id,
    decision: moderation.status,
    source: moderation.source,
    reason: moderation.reason,
    flags: moderation.flags
  });

  if (moderation.status === 'approved') {
    // Keep a privacy-safe aggregate summary warm even when no external AI provider is configured.
    await admin.functions.invoke('generate-company-summary', { body: { companyId: company.id } }).catch(() => {});
  }

  return NextResponse.json({
    id: review.id,
    status: moderation.status,
    message: moderation.status === 'approved' ? 'Published.' : moderation.status === 'rejected' ? 'This submission could not be published.' : 'Submitted for human moderation review.'
  }, { status: 201 });
}
