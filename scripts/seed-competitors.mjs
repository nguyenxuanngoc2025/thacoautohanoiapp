#!/usr/bin/env node
// scripts/seed-competitors.mjs
// Seed thaco_competitor_mapping — CHỈ trang đối thủ trực tiếp, không aggregator báo chí
// Usage: node scripts/seed-competitors.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => { const i = l.indexOf('='); if (i > 0) acc[l.slice(0, i).trim()] = l.slice(i + 1).trim(); return acc; }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Ghi chú crawl method ──────────────────────────────────────────────────────
// - RSS   : tryFetchRSS() → không cần Firecrawl
// - HTML  : fetchPageText() thường (static sites)
// - JS    : cần Firecrawl (sites dùng React/Vue/Next.js)
// Khi Firecrawl chưa có, JS sites sẽ bị bỏ qua nhưng không crash

// ── KIA THACO ─────────────────────────────────────────────────────────────────
const KIA_COMPETITORS = [
  // Toyota VN — HTML static, hoạt động tốt
  { thaco_brand: 'KIA', comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn', crawl_method: 'html' },

  // Toyota RSS — autonet coverage
  { thaco_brand: 'KIA', comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc',
    website_url: 'https://www.toyota.com.vn', crawl_method: 'html' },

  // Hyundai Thành Công VN — JS-rendered (Firecrawl)
  { thaco_brand: 'KIA', comp_brand: 'Hyundai', comp_model: null,
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn', crawl_method: 'js' },

  // Mitsubishi VN — HTML static
  { thaco_brand: 'KIA', comp_brand: 'Mitsubishi', comp_model: 'Xpander',
    news_url: 'https://www.mitsubishi-motors.com.vn/tin-tuc',
    website_url: 'https://www.mitsubishi-motors.com.vn', crawl_method: 'html' },

  { thaco_brand: 'KIA', comp_brand: 'Mitsubishi', comp_model: 'Xforce',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn', crawl_method: 'html' },

  // Honda VN — HTML static
  { thaco_brand: 'KIA', comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to', crawl_method: 'html' },

  // Ford VN — HTML static
  { thaco_brand: 'KIA', comp_brand: 'Ford', comp_model: 'Everest',
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn', crawl_method: 'html' },

  // Volkswagen VN — cạnh tranh Carnival, dùng Firecrawl
  { thaco_brand: 'KIA', comp_brand: 'Volkswagen', comp_model: 'Viloran',
    news_url: 'https://vwlongbien.vn/tin-tuc/',
    website_url: 'https://vwlongbien.vn', crawl_method: 'js' },

  // Subaru VN — 403 blocked, bỏ qua
];

// ── MAZDA THACO ───────────────────────────────────────────────────────────────
const MAZDA_COMPETITORS = [
  { thaco_brand: 'Mazda', comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn', crawl_method: 'html' },

  { thaco_brand: 'Mazda', comp_brand: 'Hyundai', comp_model: null,
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn', crawl_method: 'js' },

  { thaco_brand: 'Mazda', comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to', crawl_method: 'html' },

  { thaco_brand: 'Mazda', comp_brand: 'Ford', comp_model: null,
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn', crawl_method: 'html' },

  { thaco_brand: 'Mazda', comp_brand: 'Mitsubishi', comp_model: null,
    news_url: 'https://www.mitsubishi-motors.com.vn/tin-tuc',
    website_url: 'https://www.mitsubishi-motors.com.vn', crawl_method: 'html' },

];

// ── STELLANTIS (Peugeot, Citroën, Jeep, Fiat) ────────────────────────────────
const STELLANTIS_COMPETITORS = [
  { thaco_brand: 'Stellantis', comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn', crawl_method: 'html' },

  { thaco_brand: 'Stellantis', comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to', crawl_method: 'html' },

  { thaco_brand: 'Stellantis', comp_brand: 'Hyundai', comp_model: null,
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn', crawl_method: 'js' },

  { thaco_brand: 'Stellantis', comp_brand: 'Mitsubishi', comp_model: null,
    news_url: 'https://www.mitsubishi-motors.com.vn/tin-tuc',
    website_url: 'https://www.mitsubishi-motors.com.vn', crawl_method: 'html' },

  { thaco_brand: 'Stellantis', comp_brand: 'Ford', comp_model: 'Territory',
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn', crawl_method: 'html' },
];

// ── BMW THACO ─────────────────────────────────────────────────────────────────
const BMW_COMPETITORS = [
  // Mercedes-Benz VN — 403 blocked kể cả Firecrawl, bỏ qua

  // Lexus VN — JS-rendered
  { thaco_brand: 'BMW', comp_brand: 'Lexus', comp_model: null,
    news_url: 'https://www.lexus.com.vn',
    website_url: 'https://www.lexus.com.vn', crawl_method: 'js' },

  // Audi VN — không tìm được URL ổn định, bỏ qua
  // Volvo VN — 403 từ VPS, bỏ qua
];

// ── TẢI (Xe tải nhẹ/trung/nặng) ──────────────────────────────────────────────
const TAI_COMPETITORS = [
  // Suzuki VN (tải nhẹ)
  { thaco_brand: 'Tải', comp_brand: 'Suzuki', comp_model: null,
    news_url: 'https://suzuki.com.vn/',
    website_url: 'https://suzuki.com.vn', crawl_method: 'html' },

  // Isuzu VN (tải trung/nặng)
  { thaco_brand: 'Tải', comp_brand: 'Isuzu', comp_model: null,
    news_url: 'https://isuzu-vietnam.com/tin-tuc/',
    website_url: 'https://isuzu-vietnam.com', crawl_method: 'html' },

  // Hino VN (tải nặng)
  { thaco_brand: 'Tải', comp_brand: 'Hino', comp_model: null,
    news_url: 'https://hino.vn/tin-tuc/',
    website_url: 'https://hino.vn', crawl_method: 'html' },

  // TMT (tải trung)
  { thaco_brand: 'Tải', comp_brand: 'TMT', comp_model: null,
    news_url: 'https://tmt-vietnam.com/su-kien-khuyen-mai/',
    website_url: 'https://tmt-vietnam.com', crawl_method: 'html' },

  // Do Thanh (xe tải) — block normal fetch, dùng Firecrawl
  { thaco_brand: 'Tải', comp_brand: 'Do Thanh', comp_model: null,
    news_url: 'https://dothanhauto.com/tin-tuc/',
    website_url: 'https://dothanhauto.com', crawl_method: 'js' },

  // TERACO / Daehan (tải nhẹ)
  { thaco_brand: 'Tải', comp_brand: 'TERACO', comp_model: null,
    news_url: 'https://daehan.vn/tin-tuc/',
    website_url: 'https://daehan.vn', crawl_method: 'html' },

  // VinFast EC Van
  { thaco_brand: 'Tải', comp_brand: 'Vinfast', comp_model: 'EC Van',
    news_url: 'https://vinfastcaron.vn/tin-tuc/',
    website_url: 'https://vinfastcaron.vn', crawl_method: 'html' },

  // Hyundai Thành Công (tải)
  { thaco_brand: 'Tải', comp_brand: 'Hyundai', comp_model: null,
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn', crawl_method: 'js' },

  // Foton — 403 blocked kể cả Firecrawl, bỏ qua
  // Shineray — 403 blocked kể cả Firecrawl, bỏ qua
];

// ── BUS (Xe buýt/khách) ───────────────────────────────────────────────────────
const BUS_COMPETITORS = [
  // Hino VN
  { thaco_brand: 'Bus', comp_brand: 'Hino', comp_model: null,
    news_url: 'https://hino.vn/tin-tuc/',
    website_url: 'https://hino.vn', crawl_method: 'html' },

  // SAMCO — /tin-tuc/ trả về 404, dùng homepage
  { thaco_brand: 'Bus', comp_brand: 'SAMCO', comp_model: null,
    news_url: 'https://samco.com.vn/',
    website_url: 'https://samco.com.vn', crawl_method: 'js' },

  // Kim Long — /tin-tuc/ trả về 404, dùng homepage
  { thaco_brand: 'Bus', comp_brand: 'Kim Long', comp_model: null,
    news_url: 'https://kimlongmotor.vn/',
    website_url: 'https://kimlongmotor.vn', crawl_method: 'js' },

  // VinFast VinBus
  { thaco_brand: 'Bus', comp_brand: 'Vinfast', comp_model: 'VinBus',
    news_url: 'https://vinfastcaron.vn/tin-tuc/',
    website_url: 'https://vinfastcaron.vn', crawl_method: 'html' },

  // Hyundai Thành Công (bus)
  { thaco_brand: 'Bus', comp_brand: 'Hyundai', comp_model: null,
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn', crawl_method: 'js' },
];

// ── MINI THACO ────────────────────────────────────────────────────────────────
const MINI_COMPETITORS = [
  { thaco_brand: 'MINI', comp_brand: 'Toyota', comp_model: 'GR Yaris',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn', crawl_method: 'html' },

  { thaco_brand: 'MINI', comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to', crawl_method: 'html' },
];

const ALL_COMPETITORS = [
  ...KIA_COMPETITORS,
  ...MAZDA_COMPETITORS,
  ...STELLANTIS_COMPETITORS,
  ...BMW_COMPETITORS,
  ...TAI_COMPETITORS,
  ...BUS_COMPETITORS,
  ...MINI_COMPETITORS,
];

// Deduplicate: cùng thaco_brand + news_url → chỉ giữ 1
const seen = new Set();
const DEDUPED = ALL_COMPETITORS.filter(c => {
  const key = `${c.thaco_brand}|${c.news_url}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

async function seed() {
  console.log(`Seeding ${DEDUPED.length} competitor records (no aggregators, direct competitor sites only)...`);

  // Xóa data cũ
  const { error: delErr } = await supabase
    .from('thaco_competitor_mapping')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.warn('Delete warning:', delErr.message);

  // Insert theo batch 20
  for (let i = 0; i < DEDUPED.length; i += 20) {
    const batch = DEDUPED.slice(i, i + 20);
    const { error } = await supabase.from('thaco_competitor_mapping').insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i + 20} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted ${Math.min(i + 20, DEDUPED.length)}/${DEDUPED.length}`);
  }

  console.log('Seed complete!');
  console.log('\nSummary:');
  console.log('  KIA competitors:', KIA_COMPETITORS.length);
  console.log('  Mazda competitors:', MAZDA_COMPETITORS.length);
  console.log('  Stellantis competitors:', STELLANTIS_COMPETITORS.length);
  console.log('  BMW competitors:', BMW_COMPETITORS.length);
  console.log('  Tải competitors:', TAI_COMPETITORS.length);
  console.log('  Bus competitors:', BUS_COMPETITORS.length);
  console.log('  MINI competitors:', MINI_COMPETITORS.length);
  console.log('  Total unique records:', DEDUPED.length);
  console.log('\nNote: crawl_method="js" sites require Firecrawl to work.');
  console.log('  Set FIRECRAWL_API_URL in .env.local to enable Firecrawl scraping.');
}

seed();
