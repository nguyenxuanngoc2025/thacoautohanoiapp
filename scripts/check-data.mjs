#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => { const i = l.indexOf('='); if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc; }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Kiểm tra TẤT CẢ bảng có prefix thaco_ hoặc thac_
const candidates = [
  'thaco_budget_plans', 'thaco_actual_entries', 'thaco_events',
  'thac_budget_plans', 'thac_actual_entries', 'thac_events',
  'thaco_tasks', 'thaco_units', 'thaco_showrooms'
];

for (const t of candidates) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`[${t}] KHÔNG TỒN TẠI / lỗi: ${error.message}`);
  } else {
    console.log(`[${t}] ${count} rows`);
  }
}

// Xem 3 row đầu của events để nhận dạng
console.log('\n--- Sample 3 rows từ thaco_events ---');
const { data: evs } = await supabase.from('thaco_events').select('id, name, date, showroom').limit(3);
console.log(evs);
