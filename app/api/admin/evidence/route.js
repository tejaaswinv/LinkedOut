import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function GET(request){
  const auth=await requireAdmin();
  if(auth.error)return NextResponse.json({error:auth.error},{status:auth.status});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Supabase service role is not configured.'},{status:503});
  const id=new URL(request.url).searchParams.get('id');
  if(!id)return NextResponse.json({error:'Missing verification id.'},{status:400});
  const {data:v}=await admin.from('employment_verifications').select('evidence_path').eq('id',id).eq('method','document').eq('status','pending').maybeSingle();
  if(!v?.evidence_path)return NextResponse.json({error:'Evidence not found.'},{status:404});
  const {data,error}=await admin.storage.from('employment-evidence').createSignedUrl(v.evidence_path,300);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({url:data.signedUrl,expiresInSeconds:300});
}
