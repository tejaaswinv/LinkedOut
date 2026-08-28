import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/adminAuth';
import { createAdminClient } from '../../../../lib/supabase/admin';

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('review'), id: z.string().uuid(), decision: z.enum(['approved','rejected']) }),
  z.object({ type: z.literal('verification'), id: z.string().uuid(), decision: z.enum(['verified','rejected']), note: z.string().max(500).optional() })
]);

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

  const [{ data: reviews }, { data: verifications }] = await Promise.all([
    admin.from('reviews').select('id,user_id,company_id,pseudonym,role_title,department,location,employment_status,body,tags,moderation_reason,moderation_flags,moderation_source,created_at').eq('moderation_status','pending').order('created_at',{ascending:true}).limit(100),
    admin.from('employment_verifications').select('id,user_id,company_id,method,status,role_title,department,location,employment_status,evidence_path,created_at').eq('method','document').eq('status','pending').order('created_at',{ascending:true}).limit(100)
  ]);
  const companyIds=[...new Set([...(reviews||[]).map(x=>x.company_id),...(verifications||[]).map(x=>x.company_id)])];
  const {data:companies}=companyIds.length?await admin.from('companies').select('id,name,slug').in('id',companyIds):{data:[]};
  const companyMap=Object.fromEntries((companies||[]).map(c=>[c.id,c]));
  return NextResponse.json({
    reviews:(reviews||[]).map(r=>({...r,company:companyMap[r.company_id]||null})),
    verifications:(verifications||[]).map(v=>({...v,company:companyMap[v.company_id]||null,evidence_path:undefined,hasEvidence:Boolean(v.evidence_path)}))
  });
}

export async function PATCH(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 503 });
  let input; try { input=actionSchema.parse(await request.json()); } catch { return NextResponse.json({error:'Invalid moderation action.'},{status:400}); }

  if(input.type==='review'){
    const now=new Date().toISOString();
    const {data:review,error}=await admin.from('reviews').update({moderation_status:input.decision,published_at:input.decision==='approved'?now:null,moderation_reason:`Human moderator: ${input.decision}`}).eq('id',input.id).select('id,user_id').maybeSingle();
    if(error||!review)return NextResponse.json({error:error?.message||'Review not found.'},{status:error?500:404});
    await admin.from('moderation_events').insert({review_id:input.id,user_id:review.user_id,decision:input.decision,source:'human',reason:`Human moderator: ${input.decision}`,flags:[]});
    return NextResponse.json({ok:true});
  }

  const {data:v,error:readError}=await admin.from('employment_verifications').select('*').eq('id',input.id).maybeSingle();
  if(readError||!v)return NextResponse.json({error:readError?.message||'Verification not found.'},{status:readError?500:404});
  const now=new Date();
  const nowIso=now.toISOString();
  const verifiedUntil=input.decision==='verified'&&v.employment_status==='current'?new Date(now.getTime()+180*24*60*60*1000).toISOString():null;
  const {error}=await admin.from('employment_verifications').update({
    status:input.decision,
    verified_at:input.decision==='verified'?nowIso:null,
    verified_until:verifiedUntil,
    reviewed_at:nowIso,
    review_note:input.note||null,
    evidence_path:null,
    evidence_deleted_at:v.evidence_path?nowIso:null
  }).eq('id',input.id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(v.evidence_path)await admin.storage.from('employment-evidence').remove([v.evidence_path]);
  if(input.decision==='verified'){
    const update={position:v.role_title||undefined,department:v.department||undefined,location:v.location||undefined,employment_status:v.employment_status||undefined};
    if(v.employment_status==='current')update.current_company_id=v.company_id;
    await admin.from('profiles').update(update).eq('id',v.user_id);
  }
  return NextResponse.json({ok:true});
}
