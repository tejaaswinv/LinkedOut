import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { requireVerifiedUser } from '../../../../lib/apiAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';

const schema = z.object({
  company: z.string().min(1),
  workEmail: z.string().email(),
  role: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).optional().default(''),
  location: z.string().trim().max(120).optional().default(''),
  employmentStatus: z.enum(['current','former']).default('current')
});

function hmacCode(id, code) {
  const secret = process.env.VERIFICATION_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('VERIFICATION_CODE_SECRET is not configured.');
  return crypto.createHmac('sha256', secret).update(`${id}:${code}`).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function emailDomain(email) {
  return email.toLowerCase().split('@')[1] || '';
}

function domainMatches(actual, allowed) {
  return allowed.some((d) => actual === d.toLowerCase() || actual.endsWith(`.${d.toLowerCase()}`));
}

async function sendCode(email, companyName, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Your LinkedOut ${companyName} verification code`,
      text: `Your LinkedOut work-email verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`
    })
  });
  if (!response.ok) throw new Error(`Verification email provider returned ${response.status}.`);
  return true;
}

export async function POST(request) {
  const auth = await requireVerifiedUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = schema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid verification request.' }, { status: 400 }); }

  const { data: company } = await admin.from('companies').select('id,name,domain,domains').eq('slug', input.company).maybeSingle();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const domain = emailDomain(input.workEmail);
  const allowedDomains = [...new Set([company.domain, ...(company.domains || [])].filter(Boolean))];
  if (!allowedDomains.length || !domainMatches(domain, allowedDomains)) {
    return NextResponse.json({
      error: `That email domain does not match ${company.name}. Use a company work email or the employment-document verification option.`
    }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await admin.from('employment_verifications').insert({
    id,
    user_id: auth.user.id,
    company_id: company.id,
    method: 'work_email',
    status: 'pending',
    work_email_hash: sha256(input.workEmail.toLowerCase()),
    work_email_domain: domain,
    role_title: input.role,
    department: input.department || null,
    location: input.location || null,
    employment_status: input.employmentStatus,
    code_hash: hmacCode(id, code),
    code_expires_at: expires
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const devBypass = process.env.VERIFICATION_DEV_BYPASS === 'true';
  try {
    const sent = await sendCode(input.workEmail, company.name, code);
    if (!sent && !devBypass) {
      await admin.from('employment_verifications').delete().eq('id', id);
      return NextResponse.json({ error: 'Email delivery is not configured. Add RESEND_API_KEY or use document verification.' }, { status: 503 });
    }
  } catch (error) {
    await admin.from('employment_verifications').delete().eq('id', id);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    verificationId: id,
    expiresInSeconds: 600,
    ...(devBypass ? { devCode: code } : {})
  });
}
