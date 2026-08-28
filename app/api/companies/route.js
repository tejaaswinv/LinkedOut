import { NextResponse } from 'next/server';
import { createPublicClient } from '../../../lib/supabase/public';
import { fallbackCompanyList, mapCompanyRow } from '../../../lib/mapData';

export const dynamic = 'force-dynamic';

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
