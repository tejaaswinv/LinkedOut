import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const auth = req.headers.get('Authorization') || '';
  if (!service || auth !== `Bearer ${service}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { companyId } = await req.json();
  const [{ data: company }, { data: reviews }] = await Promise.all([
    admin.from('companies').select('id,name,industry').eq('id', companyId).maybeSingle(),
    admin.from('reviews').select('body,tags,work_life_balance,management,office_politics,compensation').eq('company_id', companyId).eq('moderation_status', 'approved').order('published_at', { ascending: false }).limit(50)
  ]);
  if (!company) return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404, headers: { 'content-type': 'application/json' } });

  const rows = reviews || [];
  const counts = new Map<string, number>();
  for (const r of rows) for (const tag of (r.tags || [])) counts.set(tag, (counts.get(tag) || 0) + 1);
  const themes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
  const summary = rows.length
    ? `Based on ${rows.length} published employee experiences, recurring themes for ${company.name} include ${themes.slice(0, 4).join(', ') || 'workplace culture and management'}.`
    : 'Not enough published employee experiences yet to generate a reliable summary.';

  await admin.from('company_summaries').upsert({
    company_id: companyId,
    summary,
    positives: [],
    concerns: themes.slice(0, 5),
    themes,
    review_count: rows.length,
    generated_at: new Date().toISOString()
  }, { onConflict: 'company_id' });

  return new Response(JSON.stringify({ companyId, summary, themes, reviewCount: rows.length }), { headers: { 'content-type': 'application/json' } });
});
