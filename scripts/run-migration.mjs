#!/usr/bin/env node
// Chạy migration SQL trên Supabase qua service role (pg_net / postgrest exec-sql RPC)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => { const i = l.indexOf('='); if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc; }, {});

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('Usage: node run-migration.mjs <path-to-sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Gọi thẳng REST endpoint SQL qua postgres-meta nếu có, fallback exec qua RPC
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  const text = await res.text();
  console.error('Migration failed:', res.status, text);
  console.error('\n⚠️ Nếu RPC exec_sql chưa có, dán SQL này vào Supabase Dashboard > SQL Editor:\n');
  console.error(sql);
  process.exit(1);
}

const result = await res.json();
console.log('Migration OK:', result);
