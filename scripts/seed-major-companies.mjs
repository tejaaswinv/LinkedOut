import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, slugify, chunk } from './catalog-env.mjs';

loadLocalEnv();
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const list=JSON.parse(fs.readFileSync(new URL('../data/major-companies.json', import.meta.url),'utf8'));
const rows=list.map(([name,domain])=>({name,slug:slugify(name,72),domain,domains:[domain],website:`https://${domain}`,source:'curated_open_catalog'}));
for(const batch of chunk(rows,100)){
  const {error}=await supabase.from('companies').upsert(batch,{onConflict:'slug',ignoreDuplicates:false});
  if(error) throw error;
}
console.log(`Seeded/updated ${rows.length} major company pages.`);
