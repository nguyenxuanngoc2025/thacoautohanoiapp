#!/usr/bin/env node
/**
 * sync_events_budget_t4.mjs
 *
 * Sync events T4/2026 → budget_entries trực tiếp (không cần HTTP server).
 * Replicates logic của /api/events/sync-budget.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => {
    const i = l.indexOf('=');
    if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    return acc;
  }, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const UNIT_ID = '17f6686e-e201-4967-8b73-a8cedc56d921';
const YEAR = 2026;
const MONTH = 4;

function resolveTargets(evBrands, dbBrands) {
  const selectedBrandNames = new Set(
    dbBrands.map(b => b.name).filter(name => evBrands.includes(name) && !/^DVPT\b/i.test(name))
  );
  return dbBrands.flatMap(brand => {
    if (!selectedBrandNames.has(brand.name)) return [];
    const selectableModels = brand.modelData
      .filter(m => !m.is_aggregate)
      .map(m => m.name);
    const explicitlySelected = selectableModels.filter(m => evBrands.includes(m));
    if (explicitlySelected.length === 0) {
      if (selectableModels.length === 0) return [{ brand: brand.name, model: brand.name }];
      return selectableModels.map(model => ({ brand: brand.name, model }));
    }
    return explicitlySelected.map(model => ({ brand: brand.name, model }));
  });
}

async function syncShowroom(showroomCode, dbBrands) {
  // Lấy showroom info
  const { data: sr, error: srErr } = await supabase
    .from('thaco_showrooms').select('id, unit_id').eq('code', showroomCode).single();
  if (srErr || !sr) { console.error(`  ✗ ${showroomCode}: không tìm thấy`); return; }

  const showroom_id = sr.id;
  const unit_id = UNIT_ID;

  // Lấy events tháng này
  const { data: allEvents } = await supabase
    .from('thaco_events').select('*').eq('showroom_code', showroomCode);

  const eventsInMonth = (allEvents ?? []).filter(row => {
    if (!row.date) return false;
    const d = new Date(row.date);
    return d.getMonth() + 1 === MONTH && d.getFullYear() === YEAR;
  });

  console.log(`  ${showroomCode}: ${eventsInMonth.length} events tháng ${MONTH}`);

  // Aggregate KPIs per (brand, model)
  const agg = new Map();
  for (const eventRow of eventsInMonth) {
    const evBrands = Array.isArray(eventRow.brands) ? eventRow.brands : [];
    const budget = Number(eventRow.budget) || 0;
    const leads  = Number(eventRow.leads)  || 0;
    const gdtd   = Number(eventRow.gdtd)   || 0;
    const deals  = Number(eventRow.deals)  || 0;

    const targets = resolveTargets(evBrands, dbBrands);
    if (targets.length === 0) continue;

    const fraction = 1 / targets.length;
    for (const { brand, model } of targets) {
      const key = `${brand}||${model}`;
      const ex = agg.get(key) ?? { plan_ns: 0, plan_khqt: 0, plan_gdtd: 0, plan_khd: 0 };
      agg.set(key, {
        plan_ns:   ex.plan_ns   + budget * fraction,
        plan_khqt: ex.plan_khqt + leads  * fraction,
        plan_gdtd: ex.plan_gdtd + gdtd   * fraction,
        plan_khd:  ex.plan_khd  + deals  * fraction,
      });
    }
  }

  // Xóa cũ + upsert mới
  await supabase.from('thaco_budget_entries').delete()
    .eq('showroom_id', showroom_id).eq('year', YEAR).eq('month', MONTH)
    .in('channel_code', ['su_kien', 'event']).eq('plan_source', 'event');

  if (agg.size > 0) {
    const upsertRows = Array.from(agg.entries()).map(([key, kpis]) => {
      const [brand_name, model_name] = key.split('||');
      return {
        unit_id, showroom_id, year: YEAR, month: MONTH,
        brand_name, model_name,
        channel_code: 'su_kien',
        plan_ns:   Math.round(kpis.plan_ns   * 100) / 100,
        plan_khqt: Math.round(kpis.plan_khqt),
        plan_gdtd: Math.round(kpis.plan_gdtd),
        plan_khd:  Math.round(kpis.plan_khd),
        plan_source: 'event',
        plan_status: 'draft',
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase.from('thaco_budget_entries')
      .upsert(upsertRows, { onConflict: 'unit_id,showroom_id,year,month,brand_name,model_name,channel_code', ignoreDuplicates: false });

    if (upsertErr) { console.error(`  ✗ ${showroomCode} upsert lỗi:`, upsertErr.message); return; }
    console.log(`    → ${agg.size} budget rows synced`);
    for (const [key, v] of agg.entries()) {
      console.log(`      ${key}: NS=${v.plan_ns} KHQT=${v.plan_khqt} GDTD=${v.plan_gdtd} KHĐ=${v.plan_khd}`);
    }
  } else {
    console.log(`    → 0 budget rows (không có model nào match)`);
  }
}

async function main() {
  console.log('=== SYNC EVENTS → BUDGET T4/2026 ===\n');

  // Load master brands + models
  const [brandsRes, modelsRes] = await Promise.all([
    supabase.from('thaco_master_brands').select('name').eq('is_active', true).order('sort_order'),
    supabase.from('thaco_master_models').select('brand_name, name, is_aggregate').eq('is_active', true).order('sort_order'),
  ]);

  const dbBrands = brandsRes.data.map(b => ({
    name: b.name,
    modelData: modelsRes.data.filter(m => m.brand_name === b.name).map(m => ({
      name: m.name, is_aggregate: m.is_aggregate ?? false,
    })),
  }));

  const SR_CODES = ['PVD', 'DT', 'NVC', 'GP', 'BD', 'HN'];
  for (const code of SR_CODES) {
    await syncShowroom(code, dbBrands);
  }

  console.log('\n✅ Sync hoàn tất');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
