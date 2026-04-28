#!/usr/bin/env node
// Clear data mẫu qua JS client (service role)
// DDL (ALTER TABLE, CONSTRAINT, COLUMN) phải chạy qua Supabase Dashboard SQL Editor
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => { const i = l.indexOf('='); if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc; }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('=== PHASE 1 DATA MIGRATION ===\n');

// 1. Clear all data
for (const table of ['thaco_budget_plans', 'thaco_actual_entries', 'thaco_events']) {
  const { error, count } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').select('*', { count: 'exact', head: true });
  if (error) {
    // Thử cách khác nếu id không phải UUID
    const { error: e2 } = await supabase.from(table).delete().not('created_at', 'is', null);
    if (e2) {
      console.error(`[${table}] Xoá lỗi:`, e2.message);
    } else {
      console.log(`[${table}] Đã clear (fallback)`);
    }
  } else {
    console.log(`[${table}] Đã clear (${count ?? 0} rows)`);
  }
}

// 2. Verify
console.log('\n=== VERIFY ===');
for (const table of ['thaco_budget_plans', 'thaco_actual_entries', 'thaco_events']) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`[${table}] ${count} rows`);
}

// 3. Dump showroom_ids state for sanity
console.log('\n=== thaco_users sample ===');
const { data: users } = await supabase
  .from('thaco_users')
  .select('email, role, showroom_id, showroom_ids, brands')
  .limit(5);
console.table(users);

console.log('\n✅ Data cleared. Bây giờ chạy DDL trong Supabase Dashboard:');
console.log('   → supabase/migrations/202604180001_bottom_up_phase1.sql');
