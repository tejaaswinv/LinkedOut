import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, slugify, chunk } from './catalog-env.mjs';

loadLocalEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const allEducation = process.argv.includes('--all-education');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { 'User-Agent': 'LinkedOut-Catalog/1.0 (university catalog sync)' };

async function fetchJson(input) {
  const response = await fetch(input, { headers, redirect: 'follow' });
  if (!response.ok) throw new Error(`ROR/Zenodo request failed (${response.status}).`);
  return response.json();
}

console.log('Resolving the latest public ROR data release…');
const versions = await fetchJson('https://zenodo.org/api/records?q=conceptrecid:6347574&all_versions=true&sort=mostrecent&size=1');
const record = versions?.hits?.hits?.[0];
if (!record) throw new Error('Could not resolve the latest ROR release from Zenodo.');
const zipFile = (record.files || []).find((file) => String(file.key || '').endsWith('.zip'));
const downloadUrl = zipFile?.links?.self || zipFile?.links?.content;
if (!downloadUrl) throw new Error('The latest ROR release does not expose a ZIP download link.');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedout-ror-'));
const zipPath = path.join(tempDir, zipFile.key || 'ror-data.zip');
console.log(`Downloading ROR ${record.metadata?.version || record.id}…`);
const download = await fetch(downloadUrl, { headers, redirect: 'follow' });
if (!download.ok) throw new Error(`ROR download failed (${download.status}).`);
fs.writeFileSync(zipPath, Buffer.from(await download.arrayBuffer()));

const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
const jsonName = listing.split(/\r?\n/).find((name) => name.endsWith('.json') && !name.includes('__MACOSX'));
if (!jsonName) throw new Error('Could not find the ROR JSON file inside the downloaded ZIP.');
const jsonPath = path.join(tempDir, path.basename(jsonName));
execFileSync('unzip', ['-p', zipPath, jsonName], { stdio: ['ignore', fs.openSync(jsonPath, 'w'), 'inherit'] });
const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const { data: existing, error: existingError } = await supabase.from('universities').select('id,name,domain,ror_id');
if (existingError) throw existingError;
const existingNames = new Set((existing || []).map((x) => String(x.name || '').trim().toLocaleLowerCase()));
const existingDomains = new Set((existing || []).map((x) => String(x.domain || '').trim().toLowerCase()).filter(Boolean));

function displayName(item) {
  const names = item.names || [];
  return names.find((x) => x.types?.includes('ror_display'))?.value
    || names.find((x) => x.types?.includes('label') && x.lang === 'en')?.value
    || names.find((x) => x.types?.includes('label'))?.value
    || '';
}
function externalId(item, type) {
  return (item.external_ids || []).find((x) => x.type === type)?.preferred
    || (item.external_ids || []).find((x) => x.type === type)?.all?.[0]
    || null;
}
function firstLink(item, type) { return (item.links || []).find((x) => x.type === type)?.value || null; }
function location(item) { return item.locations?.[0]?.geonames_details || {}; }

const rows = [];
for (const item of records) {
  if (item.status !== 'active' || !(item.types || []).includes('education')) continue;
  const name = displayName(item);
  if (!name) continue;
  const domains = item.domains || [];
  const domain = domains[0] || null;
  const already = existingNames.has(name.toLocaleLowerCase()) || (domain && existingDomains.has(domain.toLowerCase()));
  if (!allEducation && !already) continue;
  const loc = location(item);
  const rorId = String(item.id || '').replace(/^https?:\/\/ror\.org\//, '');
  rows.push({
    name,
    slug: slugify(name),
    domain,
    domains,
    website: firstLink(item, 'website') || (domain ? `https://${domain}` : null),
    city: loc.name || null,
    country: loc.country_name || null,
    source: 'ror',
    institution_type: (item.types || []).join(', '),
    founded_year: item.established || null,
    ror_id: rorId || null,
    wikidata_id: externalId(item, 'wikidata'),
    wikipedia_url: firstLink(item, 'wikipedia'),
    metadata_sources: { ror: { id: item.id, release: record.metadata?.version || null, release_date: record.metadata?.publication_date || null } },
    last_enriched_at: new Date().toISOString()
  });
}

console.log(`Writing ${rows.length} university records to LinkedOut…`);
let done = 0;
for (const batch of chunk(rows, 100)) {
  const { error } = await supabase.from('universities').upsert(batch, { onConflict: 'slug', ignoreDuplicates: false });
  if (error) throw error;
  done += batch.length;
  if (done % 1000 === 0 || done === rows.length) console.log(`${done}/${rows.length}`);
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`ROR sync complete: ${rows.length} university records.${allEducation ? ' Full education catalog enabled.' : ' Existing LinkedOut universities enriched.'}`);
