import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { requireVerifiedUser } from '../../../../lib/apiAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { sendVerificationCode } from '../../../../lib/email/resend';

const schema = z.object({
  university: z.string().min(1),
  studentEmail: z.string().email(),
  fieldOfStudy: z.string().trim().max(160).optional().default(''),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional().nullable()
});

function hmacCode(id, code) {
  const secret = process.env.VERIFICATION_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('VERIFICATION_CODE_SECRET is not configured.');
  return crypto.createHmac('sha256', secret).update(`student:${id}:${code}`).digest('hex');
}
function fingerprintEmail(value) {
  const secret = process.env.VERIFICATION_EMAIL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('VERIFICATION_EMAIL_SECRET is not configured.');
  return crypto.createHmac('sha256', secret).update(`student:${value.trim().toLowerCase()}`).digest('hex');
}
function emailDomain(email) { return email.trim().toLowerCase().split('@')[1] || ''; }
function domainMatches(actual, allowed) { return allowed.some((d) => actual === d.toLowerCase() || actual.endsWith(`.${d.toLowerCase()}`)); }
function valid(row) { return row?.status === 'verified' && (!row.verified_until || new Date(row.verified_until).getTime() > Date.now()); }

export async function POST(request) {
  const auth = await requireVerifiedUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = schema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid university verification request.' }, { status: 400 }); }

  const { data: university } = await admin.from('universities').select('id,name,domain,domains').eq('slug', input.university).maybeSingle();
  if (!university) return NextResponse.json({ error: 'University not found.' }, { status: 404 });

  const normalizedEmail = input.studentEmail.trim().toLowerCase();
  const domain = emailDomain(normalizedEmail);
  const allowed = [...new Set([university.domain, ...(university.domains || [])].filter(Boolean))];
  if (!allowed.length || !domainMatches(domain, allowed)) {
    return NextResponse.json({ error: `That email domain does not match ${university.name}. Use your university-issued email.` }, { status: 400 });
  }

  const { data: existing } = await admin.from('student_verifications').select('id,status,verified_until').eq('user_id', auth.user.id).eq('university_id', university.id).eq('status','verified').order('verified_at',{ascending:false}).limit(1).maybeSingle();
  if (valid(existing)) return NextResponse.json({ error: 'This university is already verified for your account.', alreadyVerified:true }, { status:409 });
  if (existing?.id) await admin.from('student_verifications').update({status:'expired'}).eq('id',existing.id);

  const cutoff = new Date(Date.now() - 15*60*1000).toISOString();
  const { count } = await admin.from('student_verifications').select('id',{count:'exact',head:true}).eq('user_id',auth.user.id).eq('university_id',university.id).gte('created_at',cutoff);
  if ((count || 0) >= 3) return NextResponse.json({ error:'Too many verification requests. Try again in about 15 minutes.' }, { status:429 });

  const fingerprint = fingerprintEmail(normalizedEmail);
  const { data: owner } = await admin.from('student_verifications').select('id,user_id,status,verified_until').eq('student_email_hash',fingerprint).eq('status','verified').order('verified_at',{ascending:false}).limit(1).maybeSingle();
  if (owner && !valid(owner)) await admin.from('student_verifications').update({status:'expired'}).eq('id',owner.id);
  else if (owner && owner.user_id !== auth.user.id) return NextResponse.json({ error:'That university email is already associated with another verified LinkedOut account.' }, { status:409 });

  await admin.from('student_verifications').update({status:'expired'}).eq('user_id',auth.user.id).eq('university_id',university.id).eq('status','pending');

  const id = crypto.randomUUID();
  const code = String(crypto.randomInt(100000,1000000));
  const now = new Date().toISOString();
  const expires = new Date(Date.now()+10*60*1000).toISOString();
  const { error } = await admin.from('student_verifications').insert({
    id,user_id:auth.user.id,university_id:university.id,status:'pending',method:'university_email',
    student_email_hash:fingerprint,student_email_domain:domain,email_fingerprint_version:1,
    field_of_study:input.fieldOfStudy || null,graduation_year:input.graduationYear || null,
    code_hash:hmacCode(id,code),code_sent_at:now,code_expires_at:expires
  });
  if (error) return NextResponse.json({ error:error.message }, { status:500 });

  const devBypass = process.env.VERIFICATION_DEV_BYPASS === 'true';
  try {
    const delivery = await sendVerificationCode({
      to: normalizedEmail,
      code,
      contextName: university.name,
      verificationKind: 'student'
    });
    if (!delivery.sent && !devBypass) {
      await admin.from('student_verifications').delete().eq('id',id);
      return NextResponse.json({ error:'Email delivery is not configured. Add RESEND_API_KEY or enable the local development bypass.' }, { status:503 });
    }
  } catch (error) {
    await admin.from('student_verifications').delete().eq('id',id);
    return NextResponse.json({ error:error.message }, { status:502 });
  }
  return NextResponse.json({ verificationId:id, expiresInSeconds:600, ...(devBypass ? {devCode:code} : {}) });
}
