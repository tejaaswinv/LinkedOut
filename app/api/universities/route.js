import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../lib/apiAuth';
import { createAdminClient } from '../../../lib/supabase/admin';
import { createPublicClient } from '../../../lib/supabase/public';

export const dynamic = 'force-dynamic';

const universityCreateSchema = z.object({
  name: z.string().trim().min(2, 'Enter a university name.').max(160, 'University names must be 160 characters or fewer.').refine((value) => /[\p{L}\p{N}]/u.test(value), 'Enter a valid university name.')
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const slug = (searchParams.get('slug') || '').trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));
  const supabase = createPublicClient();
  if (!supabase) return NextResponse.json({ universities: [], error: 'Supabase is not configured.' }, { status: 503 });

  let query = supabase.from('universities').select('id,slug,name,domain,domains,website,city,country,source,logo_url,description,institution_type,founded_year,ror_id,wikidata_id,wikipedia_url,ranking_provider,ranking_year,ranking_position,ranking_display,ranking_score,ranking_source_url,metadata_sources,last_enriched_at');
  if (slug) query = query.eq('slug', slug);
  query = query.order('ranking_position', { ascending: true, nullsFirst: false }).order('name').limit(limit);
  if (q) {
    const safe = q.replace(/[,%()]/g, ' ').trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,country.ilike.%${safe}%,city.ilike.%${safe}%,domain.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ universities: data || [] });
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = universityCreateSchema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid university name.' }, { status: 400 }); }

  const name = input.name.replace(/\s+/g, ' ').trim();
  const { data: possibleMatches, error: lookupError } = await admin.from('universities').select('id,slug,name,domain,domains,website,city,country,source,logo_url,description,institution_type,founded_year,ror_id,wikidata_id,wikipedia_url,ranking_provider,ranking_year,ranking_position,ranking_display,ranking_score,ranking_source_url,metadata_sources,last_enriched_at').ilike('name', name).limit(20);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  const existing = (possibleMatches || []).find((university) => university.name?.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return NextResponse.json({ university: existing, created: false });

  const baseSlug = slugify(name) || 'university';
  let slug = baseSlug;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: collision, error: collisionError } = await admin.from('universities').select('id').eq('slug', slug).maybeSingle();
    if (collisionError) return NextResponse.json({ error: collisionError.message }, { status: 500 });
    if (!collision) break;
    slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  const { data, error } = await admin.from('universities').insert({
    name,
    slug,
    source: 'user_submitted'
  }).select('id,slug,name,domain,domains,website,city,country,source,logo_url,description,institution_type,founded_year,ror_id,wikidata_id,wikipedia_url,ranking_provider,ranking_year,ranking_position,ranking_display,ranking_score,ranking_source_url,metadata_sources,last_enriched_at').single();

  if (error?.code === '23505') {
    const { data: match } = await admin.from('universities').select('id,slug,name,domain,domains,website,city,country,source,logo_url,description,institution_type,founded_year,ror_id,wikidata_id,wikipedia_url,ranking_provider,ranking_year,ranking_position,ranking_display,ranking_score,ranking_source_url,metadata_sources,last_enriched_at').eq('slug', slug).maybeSingle();
    if (match) return NextResponse.json({ university: match, created: false });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ university: data, created: true }, { status: 201 });
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
