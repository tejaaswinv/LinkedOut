import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../lib/apiAuth';
import { createAdminClient } from '../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  username: z.string().trim().regex(/^@[A-Za-z0-9_]{3,24}$/, 'Use an @username with 3-24 letters, numbers or underscores.'),
  bio: z.string().trim().max(240).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  employmentStatus: z.enum(['current','former','between_roles','student','other']).optional().nullable(),
  currentCompanyId: z.string().uuid().optional().nullable()
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const [{ data: profile }, { data: verifications }] = await Promise.all([
    admin.from('profiles').select('id,username,bio,current_company_id,position,department,location,employment_status,identity_verified_at,created_at').eq('id', auth.user.id).maybeSingle(),
    admin.from('employment_verifications').select('id,company_id,status,method,role_title,department,location,employment_status,verified_at,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false })
  ]);

  const companyIds = [...new Set((verifications || []).map((v) => v.company_id).concat(profile?.current_company_id || []).filter(Boolean))];
  const { data: companies } = companyIds.length ? await admin.from('companies').select('id,name,slug').in('id', companyIds) : { data: [] };
  const companyMap = Object.fromEntries((companies || []).map((c) => [c.id, c]));

  return NextResponse.json({
    profile: {
      ...profile,
      emailVerified: Boolean(auth.user.email_confirmed_at),
      currentCompany: companyMap[profile?.current_company_id] || null
    },
    verifications: (verifications || []).map((v) => ({ ...v, company: companyMap[v.company_id] || null }))
  });
}

export async function PATCH(request) {
  const auth = await requireUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  let input;
  try { input = profileSchema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid profile.' }, { status: 400 }); }

  const update = {
    username: input.username,
    bio: input.bio || null,
    position: input.position || null,
    department: input.department || null,
    location: input.location || null,
    employment_status: input.employmentStatus || null,
    current_company_id: input.currentCompanyId || null,
    identity_verified_at: auth.user.email_confirmed_at ? new Date().toISOString() : null
  };

  const { data, error } = await admin.from('profiles').update(update).eq('id', auth.user.id).select('*').single();
  if (error?.code === '23505') return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
