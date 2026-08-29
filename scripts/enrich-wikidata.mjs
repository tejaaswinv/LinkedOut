import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from './catalog-env.mjs';

loadLocalEnv();
const table=process.argv[2]||'universities';
const limit=Math.min(1000,Math.max(1,Number(process.argv[3]||200)));
if(!['universities','companies'].includes(table)) throw new Error('Usage: node scripts/enrich-wikidata.mjs universities|companies [limit]');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Supabase environment variables are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:rows,error}=await supabase.from(table).select('id,name,domain,wikidata_id,logo_url,description,founded_year,wikipedia_url').or('logo_url.is.null,wikidata_id.is.null,description.is.null').limit(limit);
if(error)throw error;
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
const domainOf=(value)=>{try{return new URL(/^https?:\/\//.test(value||'')?value:`https://${value}`).hostname.replace(/^www\./,'').toLowerCase();}catch{return'';}};
const claimValue=(entity,prop)=>entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
const entityId=(value)=>typeof value==='object'?value?.id:null;
async function getEntities(ids){const r=await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims|sitelinks&languages=en&format=json&origin=*`,{headers:{'User-Agent':'LinkedOutCatalog/1.0'}});if(!r.ok)throw new Error(`Wikidata ${r.status}`);return (await r.json()).entities||{};}
async function search(name){const r=await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json&origin=*`,{headers:{'User-Agent':'LinkedOutCatalog/1.0'}});if(!r.ok)return[];return (await r.json()).search||[];}
function commonsRedirect(filename){return filename?`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`:null;}
let changed=0;
for(const row of rows||[]){
  try{
    let id=row.wikidata_id;
    if(!id){
      const hits=await search(row.name); if(!hits.length){await sleep(150);continue;}
      const entities=await getEntities(hits.map((x)=>x.id));
      let best=null,bestScore=-1;
      for(const hit of hits){const e=entities[hit.id];let score=0;const label=e?.labels?.en?.value||hit.label||'';if(label.toLocaleLowerCase()===row.name.toLocaleLowerCase())score+=4;const desc=(e?.descriptions?.en?.value||'').toLowerCase();if(table==='universities'&&(desc.includes('university')||desc.includes('college')||desc.includes('institute')))score+=2;if(table==='companies'&&(desc.includes('company')||desc.includes('corporation')||desc.includes('business')))score+=2;const official=claimValue(e,'P856');if(row.domain&&domainOf(official)===domainOf(row.domain))score+=7;if(score>bestScore){bestScore=score;best=e;id=hit.id;}}
      if(bestScore<3){await sleep(150);continue;}
    }
    const entities=await getEntities([id]); const e=entities[id]; if(!e){await sleep(150);continue;}
    const logo=claimValue(e,'P154'); const website=claimValue(e,'P856'); const inception=claimValue(e,'P571'); const year=inception?.time?Number(String(inception.time).slice(1,5)):null; const enwiki=e.sitelinks?.enwiki?.title; const description=e.descriptions?.en?.value||null;
    const payload={wikidata_id:id,logo_url:row.logo_url||commonsRedirect(logo),description:row.description||description,founded_year:row.founded_year||year,wikipedia_url:row.wikipedia_url||(enwiki?`https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g,'_'))}`:null),last_enriched_at:new Date().toISOString()};
    if(table==='companies'){
      const ticker=claimValue(e,'P249'); const employees=claimValue(e,'P1128'); if(ticker)payload.ticker=ticker;if(typeof employees==='object'&&employees.amount)payload.employee_count=Number(employees.amount);
      if(website&&!row.domain)payload.website=website;
    } else if(website&&!row.domain) payload.website=website;
    const {error:updateError}=await supabase.from(table).update(payload).eq('id',row.id); if(updateError)throw updateError;changed++;console.log(`✓ ${row.name} → ${id}`);
  }catch(err){console.warn(`! ${row.name}: ${err.message}`);}
  await sleep(180);
}
console.log(`Enriched ${changed} ${table} records from Wikidata.`);
