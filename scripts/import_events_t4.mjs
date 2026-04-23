#!/usr/bin/env node
/**
 * import_events_t4.mjs
 *
 * 1. Xóa toàn bộ su_kien entries tháng 4/2026 trong budget_entries
 * 2. Insert 21 events T4 từ Excel vào thaco_events
 * 3. Trigger sync-budget cho mỗi showroom có event
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

// ─── Showroom code → UUID map (từ DB) ──────────────────────────────────────
// Code này phải khớp với thaco_showrooms.code trong DB
// Nếu sync-budget báo lỗi "không tìm thấy showroom", cần kiểm tra lại codes
const SHOWROOM_CODE_MAP = {
  '1. PVĐ':        'PVD',
  '2. Đông Trù':   'DT',
  '3. NVC':        'NVC',
  '4. GPhong':     'GP',
  '5. BĐ.TKC':    'BD',
  '6. Hà Nam':     'HN',
  '7. Đài Tư.':   'DAITU',
  '8. BMW LB':     'BMWLB',
  '9. SR LVL':     'LVL',
  '10. Chương Mỹ': 'CM',
  '11.Ninh Bình':  'NB',
};

// ─── Events extracted từ Excel Section II (T4/2026 only) ──────────────────
const EVENTS_T4 = [
  // 1. PVĐ
  { showroom: '1. PVĐ', brand: 'KIA',        date: '18/04/2026', type: 'Lái thử tập trung',        location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '1. PVĐ', brand: 'Mazda',      date: '18/04/2026', type: 'Lái thử tập trung',        location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '1. PVĐ', brand: 'STELLANTIS', date: '18/04/2026', type: 'Lái thử tập trung tại SR', location: 'Showroom', budget: 5,  khqt: 10, gdtd: 2, khd: 1, test_drives: 10 },
  // 2. Đông Trù
  { showroom: '2. Đông Trù', brand: 'KIA',        date: '25/04/2026', type: 'Lái thử tập trung', location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '2. Đông Trù', brand: 'KIA',        date: '11/04/2026', type: 'Cafe cuối tuần',     location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '2. Đông Trù', brand: 'Mazda',      date: '25/04/2026', type: 'Lái thử tập trung', location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '2. Đông Trù', brand: 'Mazda',      date: '11/04/2026', type: 'Cafe cuối tuần',     location: 'Showroom', budget: 10, khqt: 10, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '2. Đông Trù', brand: 'STELLANTIS', date: '11/04/2026', type: 'Cafe cuối tuần',     location: 'Showroom', budget: 5,  khqt: 10, gdtd: 2, khd: 1, test_drives: 10 },
  { showroom: '2. Đông Trù', brand: 'STELLANTIS', date: '25/04/2026', type: 'Lái thử tập trung', location: 'Showroom', budget: 5,  khqt: 10, gdtd: 2, khd: 1, test_drives: 10 },
  // 3. NVC
  { showroom: '3. NVC', brand: 'STELLANTIS', date: '18/04/2026', type: 'Lái thử Café cuối tuần',   location: 'Showroom', budget: 5, khqt: 10, gdtd: 5, khd: 1, test_drives: 10 },
  { showroom: '3. NVC', brand: 'STELLANTIS', date: '25/04/2026', type: 'Chăm sóc KH có sinh nhật', location: 'Showroom', budget: 3, khqt: 5,  gdtd: 1, khd: 0, test_drives: 0  },
  // 4. GPhong
  { showroom: '4. GPhong', brand: 'KIA',        date: '25/04/2026', type: 'Lái thử tập trung', location: 'Showroom', budget: 10, khqt: 18, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '4. GPhong', brand: 'KIA',        date: '18/04/2026', type: 'Cafe cuối tuần',    location: 'Showroom', budget: 10, khqt: 18, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '4. GPhong', brand: 'Mazda',      date: '25/04/2026', type: 'Lái thử tập trung', location: 'Showroom', budget: 10, khqt: 18, gdtd: 4, khd: 2, test_drives: 20 },
  { showroom: '4. GPhong', brand: 'Mazda',      date: '18/04/2026', type: 'Cafe cuối tuần',    location: 'Showroom', budget: 10, khqt: 18, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '4. GPhong', brand: 'STELLANTIS', date: '25/04/2026', type: 'Cafe cuối tuần',    location: 'Showroom', budget: 5,  khqt: 7,  gdtd: 1, khd: 1, test_drives: 5  },
  // 5. BĐ.TKC
  { showroom: '5. BĐ.TKC', brand: 'KIA',   date: '18/04/2026', type: 'Cafe cuối tuần', location: 'Showroom', budget: 10, khqt: 20, gdtd: 6, khd: 2, test_drives: 10 },
  { showroom: '5. BĐ.TKC', brand: 'Mazda', date: '18/04/2026', type: 'Cafe cuối tuần', location: 'Showroom', budget: 10, khqt: 20, gdtd: 6, khd: 2, test_drives: 10 },
  // 6. Hà Nam
  { showroom: '6. Hà Nam', brand: 'KIA',        date: '18/04/2026', type: 'Cafe cuối tuần', location: 'Showroom', budget: 10, khqt: 15, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '6. Hà Nam', brand: 'Mazda',      date: '18/04/2026', type: 'Cafe cuối tuần', location: 'Showroom', budget: 10, khqt: 15, gdtd: 4, khd: 2, test_drives: 10 },
  { showroom: '6. Hà Nam', brand: 'STELLANTIS', date: '18/04/2026', type: 'Cafe cuối tuần', location: 'Showroom', budget: 5,  khqt: 5,  gdtd: 2, khd: 1, test_drives: 5  },
  // 7-11: Không có event T4 (Đài Tư có MINI T5 → bỏ qua)
];

// ─── Helper: format date string ─────────────────────────────────────────────
function parseDate(d) {
  // "18/04/2026" → "2026-04-18"
  const parts = d.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  return d;
}

async function main() {
  console.log('=== IMPORT EVENTS T4/2026 ===\n');

  // ── Bước 1: Lấy showroom codes từ DB để verify ──────────────────────────
  const { data: showrooms, error: srErr } = await supabase
    .from('thaco_showrooms')
    .select('id, code, name')
    .eq('unit_id', UNIT_ID);

  if (srErr) {
    console.error('Lỗi lấy showrooms:', srErr.message);
    process.exit(1);
  }

  console.log('Showrooms trong DB:');
  showrooms.forEach(s => console.log(`  ${s.code.padEnd(8)} | ${s.name} | ${s.id}`));
  console.log();

  // Build map code → id từ DB thực tế
  const codeToId = Object.fromEntries(showrooms.map(s => [s.code, s.id]));

  // ── Bước 2: Xóa su_kien T4 khỏi budget_entries ─────────────────────────
  console.log('Xóa su_kien T4 từ budget_entries...');
  const { error: delErr, count: delCount } = await supabase
    .from('thaco_budget_entries')
    .delete()
    .eq('year', YEAR)
    .eq('month', MONTH)
    .eq('channel_code', 'su_kien')
    .select('*', { count: 'exact', head: true });

  if (delErr) {
    console.error('Lỗi xóa:', delErr.message);
    process.exit(1);
  }
  console.log(`  ✓ Đã xóa su_kien T4 entries\n`);

  // ── Bước 3: Insert events vào thaco_events ──────────────────────────────
  console.log('Insert events T4...');

  const eventRows = EVENTS_T4.map(ev => {
    const srCode = SHOWROOM_CODE_MAP[ev.showroom];
    if (!srCode) {
      console.warn(`  ⚠ Không có code cho showroom: ${ev.showroom}`);
      return null;
    }
    const srId = codeToId[srCode];
    if (!srId) {
      console.warn(`  ⚠ Code "${srCode}" không tìm thấy trong DB (showroom: ${ev.showroom})`);
    }

    return {
      unit_id:       UNIT_ID,
      showroom_code: srCode,
      showroom:      ev.showroom,
      name:          `${ev.type} - ${ev.brand}`,
      type:          ev.type,
      date:          parseDate(ev.date),
      location:      ev.location,
      brands:        [ev.brand],
      budget:        ev.budget,
      leads:         ev.khqt,
      gdtd:          ev.gdtd,
      deals:         ev.khd,
      test_drives:   ev.test_drives,
      status:        'upcoming',
      priority:      'medium',
    };
  }).filter(Boolean);

  const { data: inserted, error: insErr } = await supabase
    .from('thaco_events')
    .insert(eventRows)
    .select();

  if (insErr) {
    console.error('Lỗi insert events:', insErr.message);
    process.exit(1);
  }

  console.log(`  ✓ Inserted ${inserted.length} events\n`);

  // ── Bước 4: Trigger sync-budget cho các showrooms có event ──────────────
  const affectedSRCodes = [...new Set(EVENTS_T4.map(e => SHOWROOM_CODE_MAP[e.showroom]).filter(Boolean))];
  console.log(`Sync budget cho ${affectedSRCodes.length} showrooms: ${affectedSRCodes.join(', ')}`);

  const BASE_URL = env.NEXTAUTH_URL || 'http://localhost:3001';
  let syncOk = 0, syncErr = 0;

  for (const srCode of affectedSRCodes) {
    try {
      const res = await fetch(`${BASE_URL}/api/events/sync-budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showroom_code: srCode, month: MONTH, year: YEAR, unit_id: UNIT_ID }),
      });
      const json = await res.json();
      if (json.success) {
        console.log(`  ✓ ${srCode}: ${json.count} events → ${json.rows} budget rows`);
        syncOk++;
      } else {
        console.error(`  ✗ ${srCode}: ${json.error}`);
        syncErr++;
      }
    } catch (e) {
      console.error(`  ✗ ${srCode}: fetch error - ${e.message}`);
      syncErr++;
    }
  }

  console.log(`\n=== HOÀN THÀNH ===`);
  console.log(`Events: ${inserted.length} inserted`);
  console.log(`Sync: ${syncOk} OK, ${syncErr} lỗi`);
  if (syncErr > 0) {
    console.log('\n⚠ Một số showrooms sync lỗi. Kiểm tra lại SHOWROOM_CODE_MAP hoặc chạy sync thủ công.');
    console.log('  → Vào trang Events → chọn từng showroom → trigger sync-budget');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
