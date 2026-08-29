import fs from 'node:fs';
import path from 'node:path';

export function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    const file = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

export function slugify(value, max = 80) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
}

export function chunk(items, size = 250) {
  const result=[]; for(let i=0;i<items.length;i+=size) result.push(items.slice(i,i+size)); return result;
}
