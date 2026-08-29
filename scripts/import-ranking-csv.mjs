import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, slugify } from './catalog-env.mjs';

loadLocalEnv();
const [,,table,input,provider,yearArg,sourceUrl='']=process.argv;
if(!['universities','companies'].includes(table)||!input||!provider||!yearArg) throw new Error('Usage: node scripts/import-ranking-csv.mjs universities|companies file.csv PROVIDER YEAR [SOURCE_URL]');
const year=Number(yearArg);
if(!Number.isInteger(year)) throw new Error('YEAR must be an integer.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Supabase environment variables are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some((v)=>v.trim()))rows.push(row);row=[];field='';}else field+=c;} row.push(field);if(row.some((v)=>v.trim()))rows.push(row);return rows;
}
const rows=parseCsv(fs.readFileSync(input,'utf8')); const headers=rows.shift().map((x)=>x.trim().toLowerCase());
const idx=(...names)=>names.map((n)=>headers.indexOf(n)).find((i)=>i>=0)??-1;
const nameI=idx('name','university','company','institution'); const rankI=idx('rank','ranking','position'); const scoreI=idx('score','overall score','overall_score'); const cityI=idx('city'); const countryI=idx('country','country/territory');
if(nameI<0||rankI<0) throw new Error('CSV needs name/university/company and rank columns. Convert an authorized export to CSV first.');
let updated=0;
for(const row of rows){
  const name=(row[nameI]||'').trim(); if(!name)continue;
  const rawRank=(row[rankI]||'').trim(); const numeric=Number(rawRank.replace(/[^0-9]/g,''));
  const payload={ranking_provider:provider,ranking_year:year,ranking_position:Number.isFinite(numeric)&&numeric>0?numeric:null,ranking_source_url:sourceUrl||null};
  if(table==='universities'){
    payload.ranking_display=rawRank||null;
    payload.ranking_score=scoreI>=0&&Number.isFinite(Number(row[scoreI]))?Number(row[scoreI]):null;
    if(cityI>=0&&row[cityI]?.trim())payload.city=row[cityI].trim();
    if(countryI>=0&&row[countryI]?.trim())payload.country=row[countryI].trim();
  }
  const {data,error}=await supabase.from(table).update(payload).ilike('name',name).select('id').limit(1);
  if(error) throw error;
  if(data?.length){updated++;continue;}
  const insert={name,slug:slugify(name,table==='companies'?72:80),source:`${provider.toLowerCase()}_authorized_import`,...payload};
  if(table==='universities'){if(cityI>=0)insert.city=row[cityI]?.trim()||null;if(countryI>=0)insert.country=row[countryI]?.trim()||null;}
  const {error:insertError}=await supabase.from(table).upsert(insert,{onConflict:'slug'}); if(insertError)throw insertError; updated++;
}
console.log(`Imported ${updated} ${table} ranking rows from authorized CSV source ${provider} ${year}.`);
