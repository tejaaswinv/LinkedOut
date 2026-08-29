import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, slugify, chunk } from './catalog-env.mjs';

loadLocalEnv();
const input=process.argv[2];
const allEducation=process.argv.includes('--all-education');
if(!input) throw new Error('Usage: node scripts/import-ror-universities.mjs /path/to/ror-data.json [--all-education]');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Supabase environment variables are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const records=JSON.parse(fs.readFileSync(input,'utf8'));
const {data:existing,error:existingError}=await supabase.from('universities').select('id,name,domain,ror_id');
if(existingError) throw existingError;
const existingNames=new Set((existing||[]).map((x)=>String(x.name||'').trim().toLocaleLowerCase()));
const existingDomains=new Set((existing||[]).map((x)=>String(x.domain||'').trim().toLowerCase()).filter(Boolean));

function displayName(record){
  const names=record.names||[];
  return names.find((x)=>x.types?.includes('ror_display'))?.value || names.find((x)=>x.types?.includes('label')&&x.lang==='en')?.value || names.find((x)=>x.types?.includes('label'))?.value || '';
}
function externalId(record,type){return (record.external_ids||[]).find((x)=>x.type===type)?.preferred || (record.external_ids||[]).find((x)=>x.type===type)?.all?.[0] || null;}
function firstLink(record,type){return (record.links||[]).find((x)=>x.type===type)?.value || null;}
function location(record){return record.locations?.[0]?.geonames_details || {};}

const rows=[];
for(const record of records){
  if(record.status!=='active'||!(record.types||[]).includes('education')) continue;
  const name=displayName(record); if(!name) continue;
  const domains=record.domains||[]; const domain=domains[0]||null;
  const already=existingNames.has(name.toLocaleLowerCase()) || (domain&&existingDomains.has(domain.toLowerCase()));
  if(!allEducation&&!already) continue;
  const loc=location(record);
  const rorId=String(record.id||'').replace(/^https?:\/\/ror\.org\//,'');
  rows.push({
    name,slug:slugify(name),domain,domains,website:firstLink(record,'website')||(domain?`https://${domain}`:null),city:loc.name||null,country:loc.country_name||null,
    source:'ror',institution_type:(record.types||[]).join(', '),founded_year:record.established||null,ror_id:rorId||null,wikidata_id:externalId(record,'wikidata'),
    wikipedia_url:firstLink(record,'wikipedia'),metadata_sources:{ror:{id:record.id,updated:record.admin?.last_modified?.date||null}},last_enriched_at:new Date().toISOString()
  });
}
for(const batch of chunk(rows,100)){
  const {error}=await supabase.from('universities').upsert(batch,{onConflict:'slug',ignoreDuplicates:false});
  if(error) throw error;
}
console.log(`Imported/enriched ${rows.length} university records from ROR.${allEducation?' (--all-education enabled)':' (existing LinkedOut universities only)'}`);
