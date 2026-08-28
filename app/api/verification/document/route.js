import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireVerifiedUser } from '../../../../lib/apiAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';

const ALLOWED = new Set(['application/pdf','image/png','image/jpeg','image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

function cleanName(name = 'proof') {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-100);
}

export async function POST(request) {
  const auth = await requireVerifiedUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const form = await request.formData();
  const companySlug = String(form.get('company') || '');
  const role = String(form.get('role') || '').trim().slice(0, 120);
  const department = String(form.get('department') || '').trim().slice(0, 120);
  const location = String(form.get('location') || '').trim().slice(0, 120);
  const employmentStatus = String(form.get('employmentStatus') || 'former');
  const file = form.get('file');

  if (!companySlug || role.length < 2 || !['current','former'].includes(employmentStatus)) {
    return NextResponse.json({ error: 'Company, role and employment status are required.' }, { status: 400 });
  }
  if (!file || typeof file === 'string' || !ALLOWED.has(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Upload a PDF, PNG, JPG or WebP file up to 8 MB.' }, { status: 400 });
  }

  const { data: company } = await admin.from('companies').select('id,name').eq('slug', companySlug).maybeSingle();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const id = crypto.randomUUID();
  const path = `${auth.user.id}/${id}/${cleanName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('employment-evidence').upload(path, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: `Could not securely store proof: ${uploadError.message}` }, { status: 500 });

  const { error } = await admin.from('employment_verifications').insert({
    id,
    user_id: auth.user.id,
    company_id: company.id,
    method: 'document',
    status: 'pending',
    role_title: role,
    department: department || null,
    location: location || null,
    employment_status: employmentStatus,
    evidence_path: path
  });
  if (error) {
    await admin.storage.from('employment-evidence').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    verificationId: id,
    status: 'pending',
    message: 'Proof uploaded privately for manual verification. It is never shown on your public profile.'
  }, { status: 201 });
}
