import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../lib/apiAuth';
import { mapCompanyRow, fallbackCompanyList } from '../../../lib/mapData';
import { createAdminClient } from '../../../lib/supabase/admin';
import { createPublicClient } from '../../../lib/supabase/public';

export const dynamic = 'force-dynamic';

const companyCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a company name.').max(120, 'Company names must be 120 characters or fewer.').refine((value) => /[\p{L}\p{N}]/u.test(value), 'Enter a valid company name.')
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const slug = (searchParams.get('slug') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 60)));
  const supabase = createPublicClient();

  if (!supabase) {
    let items = fallbackCompanyList();
    if (slug) items = items.filter((c) => c.slug === slug);
    if (q) {
      const n = q.toLowerCase();
      items = items.filter((c) => `${c.name} ${c.sector} ${c.location}`.toLowerCase().includes(n));
    }
    return NextResponse.json({ companies: items.slice(0, limit), source: 'fallback' });
  }

  let query = supabase.from('company_public_stats').select('*');
  if (slug) query = query.eq('slug', slug);
  if (q) {
    const safe = q.replace(/[,%()]/g, ' ').trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,industry.ilike.%${safe}%,hq_country.ilike.%${safe}%,hq_city.ilike.%${safe}%`);
  }
  query = query.order('review_count', { ascending: false }).order('name', { ascending: true }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: (data || []).map(mapCompanyRow), source: 'supabase' });
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = companyCreateSchema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid company name.' }, { status: 400 }); }

  const name = input.name.replace(/\s+/g, ' ').trim();
  const { data: possibleMatches, error: lookupError } = await admin.from('companies').select('*').ilike('name', name).limit(20);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  const existing = (possibleMatches || []).find((company) => company.name?.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return NextResponse.json({ company: mapCompanyRow(existing), created: false });

  const baseSlug = slugify(name) || 'company';
  let slug = baseSlug;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: collision, error: collisionError } = await admin.from('companies').select('id').eq('slug', slug).maybeSingle();
    if (collisionError) return NextResponse.json({ error: collisionError.message }, { status: 500 });
    if (!collision) break;
    slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  const { data, error } = await admin.from('companies').insert({
    name,
    slug,
    source: 'user_submitted'
  }).select('*').single();

  if (error?.code === '23505') {
    const { data: match } = await admin.from('companies').select('*').eq('slug', slug).maybeSingle();
    if (match) return NextResponse.json({ company: mapCompanyRow(match), created: false });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: mapCompanyRow(data), created: true }, { status: 201 });
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}
