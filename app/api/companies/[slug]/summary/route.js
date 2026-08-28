import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { generateCompanySummary } from '../../../../../lib/companySummary';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { slug } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const { data: company } = await admin.from('companies').select('id,name').eq('slug', slug).maybeSingle();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  const { data: summary } = await admin.from('company_summaries').select('*').eq('company_id', company.id).maybeSingle();
  return NextResponse.json({ summary });
}

export async function POST(request, { params }) {
  const authorization = request.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET;
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { slug } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const { data: company } = await admin.from('companies').select('*').eq('slug', slug).maybeSingle();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const { data: reviews, error } = await admin.from('reviews')
    .select('role_title,department,location,employment_status,body,tags,work_life_balance,management,office_politics,compensation,published_at')
    .eq('company_id', company.id)
    .eq('moderation_status', 'approved')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const generated = await generateCompanySummary(company, reviews || []);
  if (!generated) return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 503 });

  const { data: summary, error: saveError } = await admin.from('company_summaries').upsert({
    company_id: company.id,
    ...generated,
    review_count: reviews?.length || 0,
    generated_at: new Date().toISOString()
  }, { onConflict: 'company_id' }).select('*').single();
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ summary });
}
