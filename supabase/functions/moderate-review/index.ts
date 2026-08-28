import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phoneRe = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const urlRe = /\bhttps?:\/\/\S+/gi;
const threatRe = /\b(?:kill|murder|shoot|stab|bomb|hurt)\s+(?:him|her|them|my boss|my manager|that manager)\b/i;

function redact(text: string) {
  const flags: string[] = [];
  let safe = text;
  if (emailRe.test(safe)) flags.push('email');
  emailRe.lastIndex = 0;
  safe = safe.replace(emailRe, '[email removed]');
  if (phoneRe.test(safe)) flags.push('phone');
  phoneRe.lastIndex = 0;
  safe = safe.replace(phoneRe, '[phone removed]');
  if (urlRe.test(safe)) flags.push('link');
  urlRe.lastIndex = 0;
  safe = safe.replace(urlRe, '[link removed]');
  return { safe, flags };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const auth = req.headers.get('Authorization') || '';
  if (!service || auth !== `Bearer ${service}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { reviewId } = await req.json();
  const { data: review } = await admin.from('reviews').select('id,user_id,body').eq('id', reviewId).maybeSingle();
  if (!review) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });

  const { safe, flags } = redact(review.body || '');
  let decision = 'approved';
  let reason = 'Deterministic moderation passed';
  if (threatRe.test(safe)) {
    decision = 'rejected';
    flags.push('threat');
    reason = 'Threatening or violent content';
  }

  await admin.from('reviews').update({
    moderation_status: decision,
    moderation_source: 'edge',
    moderation_reason: reason,
    moderation_flags: flags,
    body: safe,
    published_at: decision === 'approved' ? new Date().toISOString() : null
  }).eq('id', reviewId);

  await admin.from('moderation_events').insert({
    review_id: reviewId,
    user_id: review.user_id,
    decision,
    source: 'edge',
    reason,
    flags
  });

  return new Response(JSON.stringify({ reviewId, status: decision, flags }), { headers: { 'content-type': 'application/json' } });
});
