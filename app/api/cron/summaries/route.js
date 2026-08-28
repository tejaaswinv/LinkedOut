import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { generateCompanySummary } from '../../../../lib/companySummary';

export const maxDuration = 60;

export async function GET(request){
  const auth=request.headers.get('authorization')||'';
  if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized.'},{status:401});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Supabase service role is not configured.'},{status:503});

  const {data:stats,error}=await admin.from('company_public_stats').select('id,slug,name,industry,review_count,summary_generated_at').gte('review_count',3).order('review_count',{ascending:false}).limit(100);
  if(error)return NextResponse.json({error:error.message},{status:500});
  const stale=(stats||[]).filter(c=>!c.summary_generated_at||Date.now()-new Date(c.summary_generated_at).getTime()>6*60*60*1000).slice(0,6);
  const refreshed=[];
  for(const company of stale){
    const {data:reviews}=await admin.from('reviews').select('role_title,department,location,employment_status,body,tags,work_life_balance,management,office_politics,compensation,published_at').eq('company_id',company.id).eq('moderation_status','approved').order('published_at',{ascending:false}).limit(50);
    const generated=await generateCompanySummary(company,reviews||[]);
    if(!generated)break;
    const {error:saveError}=await admin.from('company_summaries').upsert({company_id:company.id,...generated,review_count:reviews?.length||0,generated_at:new Date().toISOString()},{onConflict:'company_id'});
    if(!saveError)refreshed.push(company.slug);
  }
  return NextResponse.json({refreshed,checked:stale.length});
}
