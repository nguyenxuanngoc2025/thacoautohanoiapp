#!/usr/bin/env node
/**
 * Clear toàn bộ data mẫu từ 3 bảng: thac_budget_plans, thac_actual_entries, thac_events
 * Xoá TẤT CẢ units (toàn DB), TẤT CẢ years.
 *
 * Chạy: node scripts/clear-sample-data.mjs
 * Yêu cầu: SUPABASE_SERVICE_ROLE_KEY trong .env.local
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => {
    const i = l.indexOf('=');
    if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return acc;
  }, {});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ['thaco_budget_plans', 'thaco_actual_entries', 'thaco_events'];

console.log('='.repeat(60));
console.log('CLEAR SAMPLE DATA — TẤT CẢ units, TẤT CẢ years');
console.log('='.repeat(60));

for (const table of tables) {
  // Đếm trước
  const { count: before, error: e1 } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (e1) { console.error(`[${table}] Lỗi đếm:`, e1.message); continue; }
  console.log(`[${table}] Trước: ${before} rows`);

  // Xoá tất cả (dùng gt với id dummy để bypass "no filter" safety)
  const { error: e2 } = await supabase
    .from(table)
    .delete()
    .gte('created_at', '1900-01-01');
  if (e2) {
    // Fallback: dùng neq với uuid trống
    const { error: e3 } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e3) { console.error(`[${table}] Lỗi xoá:`, e3.message); continue; }
  }

  const { count: after } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`[${table}] Sau: ${after} rows — đã xoá ${(before ?? 0) - (after ?? 0)} rows ✓`);
}

console.log('='.repeat(60));
console.log('HOÀN TẤT');
