import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { requireVerifiedUser } from '../../../../lib/apiAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';

const schema = z.object({ verificationId:z.string().uuid(), code:z.string().regex(/^\d{6}$/) });
function hmacCode(id, code) {
  const secret = process.env.VERIFICATION_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('VERIFICATION_CODE_SECRET is not configured.');
  return crypto.createHmac('sha256',secret).update(`student:${id}:${code}`).digest('hex');
}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}

export async function POST(request){
  const auth=await requireVerifiedUser();
  if(auth.error)return NextResponse.json({error:auth.error},{status:auth.status});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Supabase service role is not configured.'},{status:503});
  let input;try{input=schema.parse(await request.json());}catch{return NextResponse.json({error:'Enter the 6-digit verification code.'},{status:400});}

  const {data:row}=await admin.from('student_verifications').select('*').eq('id',input.verificationId).eq('user_id',auth.user.id).maybeSingle();
  if(!row)return NextResponse.json({error:'Verification request not found.'},{status:404});
  if(row.status==='verified')return NextResponse.json({verified:true,verifiedUntil:row.verified_until||null});
  if(row.status!=='pending')return NextResponse.json({error:`Verification is ${row.status}.`},{status:400});
  if(row.attempts>=5){await admin.from('student_verifications').update({status:'expired',code_hash:null,code_expires_at:null}).eq('id',row.id);return NextResponse.json({error:'Too many attempts. Start a new verification.'},{status:429});}
  if(!row.code_expires_at||new Date(row.code_expires_at).getTime()<Date.now()){await admin.from('student_verifications').update({status:'expired',code_hash:null,code_expires_at:null}).eq('id',row.id);return NextResponse.json({error:'Code expired. Start a new verification.'},{status:400});}
  const expected=hmacCode(row.id,input.code);
  if(!safeEqual(expected,row.code_hash)){await admin.from('student_verifications').update({attempts:row.attempts+1}).eq('id',row.id);return NextResponse.json({error:'Incorrect code.'},{status:400});}

  const now=new Date();const verifiedAt=now.toISOString();const verifiedUntil=new Date(now.getTime()+365*24*60*60*1000).toISOString();
  const {error}=await admin.from('student_verifications').update({status:'verified',verified_at:verifiedAt,verified_until:verifiedUntil,code_hash:null,code_expires_at:null}).eq('id',row.id);
  if(error?.code==='23505')return NextResponse.json({error:'That university email is already associated with another verified LinkedOut account.'},{status:409});
  if(error)return NextResponse.json({error:error.message},{status:500});

  await admin.from('profiles').update({current_university_id:row.university_id,field_of_study:row.field_of_study||undefined,graduation_year:row.graduation_year||undefined,employment_status:'student',identity_verified_at:auth.user.email_confirmed_at?verifiedAt:undefined}).eq('id',auth.user.id);
  return NextResponse.json({verified:true,verifiedUntil});
}
