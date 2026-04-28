#!/usr/bin/env node
// apply-migration.mjs — apply SQL migration bằng cách split từng statement
// Usage: node scripts/apply-migration.mjs supabase/migrations/xxx.sql

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => {
    const i = l.indexOf('=');
    if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return acc;
  }, {});

const migrationPath = process.argv[2];
if (!migrationPath) { console.error('Usage: node apply-migration.mjs <path-to-sql>'); process.exit(1); }

const sql = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');

// Tách thành từng statement (bỏ comment, bỏ dòng trống)
const statements = sql
  .split(';')
  .map(s => s.replace(/--[^\n]*/g, '').trim())
  .filter(s => s.length > 0);

console.log(`Applying ${statements.length} statements from ${migrationPath}...`);

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

let ok = 0, skip = 0, fail = 0;

for (const stmt of statements) {
  const res = await fetch(`${BASE}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: stmt }),
  });

  const text = await res.text();

  if (res.status === 204 || res.status === 200) {
    console.log(`  OK [${res.status}]: ${stmt.slice(0, 60).replace(/\s+/g, ' ')}...`);
    ok++;
  } else {
    // Bỏ qua lỗi "already exists"
    const isAlreadyExists = text.includes('42P07') || text.includes('already exists') || text.includes('42710');
    if (isAlreadyExists) {
      console.log(`  SKIP (already exists): ${stmt.slice(0, 60).replace(/\s+/g, ' ')}...`);
      skip++;
    } else {
      console.error(`  FAIL [${res.status}]: ${stmt.slice(0, 80).replace(/\s+/g, ' ')}`);
      console.error(`         Error: ${text.slice(0, 200)}`);
      fail++;
    }
  }
}

console.log(`\nDone: ${ok} OK, ${skip} skipped, ${fail} failed`);
if (fail > 0) process.exit(1);
