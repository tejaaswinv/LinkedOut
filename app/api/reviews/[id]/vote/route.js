import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVerifiedUser } from '../../../../../lib/apiAuth';
import { createAdminClient } from '../../../../../lib/supabase/admin';

const schema=z.object({value:z.union([z.literal(-1),z.literal(0),z.literal(1)])});

export async function POST(request,{params}){
  const auth=await requireVerifiedUser();
  if(auth.error)return NextResponse.json({error:auth.error},{status:auth.status});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Supabase service role is not configured.'},{status:503});
  const {id}=await params;
  let input;try{input=schema.parse(await request.json())}catch{return NextResponse.json({error:'Invalid vote.'},{status:400})}
  const {data:review}=await admin.from('reviews').select('id').eq('id',id).eq('moderation_status','approved').maybeSingle();
  if(!review)return NextResponse.json({error:'Review not found.'},{status:404});
  if(input.value===0)await admin.from('review_votes').delete().eq('review_id',id).eq('user_id',auth.user.id);
  else await admin.from('review_votes').upsert({review_id:id,user_id:auth.user.id,value:input.value},{onConflict:'review_id,user_id'});
  const {data:votes}=await admin.from('review_votes').select('value').eq('review_id',id);
  const score=(votes||[]).reduce((s,v)=>s+Number(v.value||0),0);
  return NextResponse.json({score,userVote:input.value});
}
