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
  currentCompanyId: z.string().uuid().optional().nullable(),
  currentUniversityId: z.string().uuid().optional().nullable(),
  fieldOfStudy: z.string().trim().max(160).optional().nullable(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  showCompany: z.boolean().optional(),
  showPosition: z.boolean().optional(),
  showDepartment: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  showUniversity: z.boolean().optional(),
  showFieldOfStudy: z.boolean().optional(),
  showGraduationYear: z.boolean().optional(),
  completeOnboarding: z.boolean().optional()
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const [{ data: profile }, { data: verifications }, { data: studentVerifications }] = await Promise.all([
    admin.from('profiles').select('id,username,bio,current_company_id,current_university_id,position,department,location,employment_status,field_of_study,graduation_year,identity_verified_at,onboarding_completed_at,show_company,show_position,show_department,show_location,show_university,show_field_of_study,show_graduation_year,created_at').eq('id', auth.user.id).maybeSingle(),
    admin.from('employment_verifications').select('id,company_id,status,method,role_title,department,location,employment_status,verified_at,verified_until,reviewed_at,review_note,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }),
    admin.from('student_verifications').select('id,university_id,status,method,field_of_study,graduation_year,verified_at,verified_until,reviewed_at,review_note,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false })
  ]);

  const companyIds = [...new Set((verifications || []).map((v) => v.company_id).concat(profile?.current_company_id || []).filter(Boolean))];
  const universityIds = [...new Set((studentVerifications || []).map((v) => v.university_id).concat(profile?.current_university_id || []).filter(Boolean))];
  const [{ data: companies }, { data: universities }] = await Promise.all([
    companyIds.length ? admin.from('companies').select('id,name,slug').in('id', companyIds) : Promise.resolve({ data: [] }),
    universityIds.length ? admin.from('universities').select('id,name,slug,domain,city,country').in('id', universityIds) : Promise.resolve({ data: [] })
  ]);
  const companyMap = Object.fromEntries((companies || []).map((c) => [c.id, c]));
  const universityMap = Object.fromEntries((universities || []).map((u) => [u.id, u]));

  return NextResponse.json({
    profile: {
      ...profile,
      emailVerified: Boolean(auth.user.email_confirmed_at),
      currentCompany: companyMap[profile?.current_company_id] || null,
      currentUniversity: universityMap[profile?.current_university_id] || null,
      onboardingComplete: Boolean(profile?.onboarding_completed_at)
    },
    verifications: (verifications || []).map((v) => ({ ...v, company: companyMap[v.company_id] || null })),
    studentVerifications: (studentVerifications || []).map((v) => ({ ...v, university: universityMap[v.university_id] || null }))
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

  const isStudent = input.employmentStatus === 'student';
  const isEmployee = ['current','former'].includes(input.employmentStatus);
  const update = {
    username: input.username,
    bio: input.bio || null,
    position: input.position || null,
    department: input.department || null,
    location: input.location || null,
    employment_status: input.employmentStatus || null,
    current_company_id: isEmployee ? (input.currentCompanyId || null) : null,
    current_university_id: isStudent ? (input.currentUniversityId || null) : null,
    field_of_study: isStudent ? (input.fieldOfStudy || null) : null,
    graduation_year: isStudent ? (input.graduationYear || null) : null,
    show_company: input.showCompany ?? true,
    show_position: input.showPosition ?? true,
    show_department: input.showDepartment ?? false,
    show_location: input.showLocation ?? true,
    show_university: input.showUniversity ?? true,
    show_field_of_study: input.showFieldOfStudy ?? true,
    show_graduation_year: input.showGraduationYear ?? false,
    identity_verified_at: auth.user.email_confirmed_at ? new Date().toISOString() : null,
    ...(input.completeOnboarding ? { onboarding_completed_at: new Date().toISOString() } : {})
  };

  const { data, error } = await admin.from('profiles').update(update).eq('id', auth.user.id).select('*').single();
  if (error?.code === '23505') return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
