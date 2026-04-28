#!/usr/bin/env node
// scripts/seed-competitors.mjs
// Seed thaco_competitor_mapping
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

// ── Nguồn tin tức tổng hợp (RSS, cover nhiều brand) ──────────────────────────
// Deduplicate theo news_url → mỗi URL chỉ crawl 1 lần, thaco_brands gộp lại
const NEWS_AGGREGATORS = [
  // autonet.com.vn — RSS hoạt động tốt, chuyên ô tô VN
  { thaco_brand: 'KIA',        comp_brand: 'Market', news_url: 'https://autonet.com.vn/feed' },
  { thaco_brand: 'Mazda',      comp_brand: 'Market', news_url: 'https://autonet.com.vn/feed' },
  { thaco_brand: 'Stellantis', comp_brand: 'Market', news_url: 'https://autonet.com.vn/feed' },
  { thaco_brand: 'Tải',        comp_brand: 'Market', news_url: 'https://autonet.com.vn/feed' },

  // vnexpress.net — RSS ô tô, tin thị trường chung
  { thaco_brand: 'KIA',        comp_brand: 'Market', news_url: 'https://vnexpress.net/rss/oto-xe-may.rss' },
  { thaco_brand: 'Mazda',      comp_brand: 'Market', news_url: 'https://vnexpress.net/rss/oto-xe-may.rss' },
  { thaco_brand: 'BMW',        comp_brand: 'Market', news_url: 'https://vnexpress.net/rss/oto-xe-may.rss' },

  // otofun.net — forum, tin thực từ dealer/khách hàng
  { thaco_brand: 'KIA',        comp_brand: 'Market', news_url: 'https://otofun.net/forums/-/index.rss' },
  { thaco_brand: 'Mazda',      comp_brand: 'Market', news_url: 'https://otofun.net/forums/-/index.rss' },
];

// ── Nguồn trực tiếp từ hãng (HTML fetch, đã test hoạt động) ──────────────────
const MANUFACTURER_SOURCES = [
  // Toyota VN — HTML tĩnh, có nội dung
  { thaco_brand: 'KIA',   comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn' },
  { thaco_brand: 'Mazda', comp_brand: 'Toyota', comp_model: null,
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn' },

  // Mitsubishi VN — HTML tĩnh, có nội dung
  { thaco_brand: 'KIA',        comp_brand: 'Mitsubishi', comp_model: 'Xpander',
    news_url: 'https://www.mitsubishi-motors.com.vn/tin-tuc',
    website_url: 'https://www.mitsubishi-motors.com.vn' },
  { thaco_brand: 'KIA',        comp_brand: 'Mitsubishi', comp_model: 'Xforce',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn' },
  { thaco_brand: 'Stellantis', comp_brand: 'Mitsubishi', comp_model: null,
    news_url: 'https://www.mitsubishi-motors.com.vn/tin-tuc',
    website_url: 'https://www.mitsubishi-motors.com.vn' },

  // Honda VN — HTML với content
  { thaco_brand: 'KIA',   comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to' },
  { thaco_brand: 'Mazda', comp_brand: 'Honda', comp_model: null,
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to' },

  // Ford VN
  { thaco_brand: 'KIA',        comp_brand: 'Ford', comp_model: 'Everest',
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn' },
  { thaco_brand: 'Stellantis', comp_brand: 'Ford', comp_model: 'Territory',
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn' },

  // Suzuki VN (xe tải nhẹ)
  { thaco_brand: 'Tải', comp_brand: 'Suzuki', comp_model: null,
    news_url: 'https://suzuki.com.vn/',
    website_url: 'https://suzuki.com.vn' },

  // Isuzu VN (tải trung/nặng)
  { thaco_brand: 'Tải', comp_brand: 'Isuzu', comp_model: null,
    news_url: 'https://isuzu-vietnam.com/tin-tuc/',
    website_url: 'https://isuzu-vietnam.com' },

  // Hino VN (xe bus/tải nặng)
  { thaco_brand: 'Tải', comp_brand: 'Hino', comp_model: null,
    news_url: 'https://hino.vn/tin-tuc/',
    website_url: 'https://hino.vn' },
  { thaco_brand: 'Bus',  comp_brand: 'Hino', comp_model: null,
    news_url: 'https://hino.vn/tin-tuc/',
    website_url: 'https://hino.vn' },

  // TMT (tải trung)
  { thaco_brand: 'Tải', comp_brand: 'TMT', comp_model: null,
    news_url: 'https://tmt-vietnam.com/su-kien-khuyen-mai/',
    website_url: 'https://tmt-vietnam.com' },

  // SAMCO (bus)
  { thaco_brand: 'Bus', comp_brand: 'SAMCO', comp_model: null,
    news_url: 'https://samco.com.vn/tin-tuc/',
    website_url: 'https://samco.com.vn' },

  // Kim Long (bus)
  { thaco_brand: 'Bus', comp_brand: 'Kim Long', comp_model: null,
    news_url: 'https://kimlongmotor.vn/tin-tuc/',
    website_url: 'https://kimlongmotor.vn' },

  // Do Thanh (xe tải)
  { thaco_brand: 'Tải', comp_brand: 'Do Thanh', comp_model: null,
    news_url: 'https://dothanhauto.com/tin-tuc/',
    website_url: 'https://dothanhauto.com' },

  // TERACO / Daehan (tải nhẹ)
  { thaco_brand: 'Tải', comp_brand: 'TERACO', comp_model: null,
    news_url: 'https://daehan.vn/tin-tuc/',
    website_url: 'https://daehan.vn' },

  // VinFast (tải van + bus điện)
  { thaco_brand: 'Tải', comp_brand: 'Vinfast', comp_model: 'EC Van',
    news_url: 'https://vinfastcaron.vn/tin-tuc/',
    website_url: 'https://vinfastcaron.vn' },
  { thaco_brand: 'Bus',  comp_brand: 'Vinfast', comp_model: 'VinBus',
    news_url: 'https://vinfastcaron.vn/tin-tuc/',
    website_url: 'https://vinfastcaron.vn' },

  // Volkswagen VN (cạnh tranh KIA Carnival)
  { thaco_brand: 'KIA', comp_brand: 'Volkswagen', comp_model: 'Viloran',
    news_url: 'https://vwlongbien.vn/tin-tuc/',
    website_url: 'https://vwlongbien.vn' },

  // BMW (cạnh tranh BMW THACO)
  { thaco_brand: 'BMW', comp_brand: 'Mercedes', comp_model: null,
    news_url: 'https://www.mercedes-benz.com.vn/passengercars/mercedes-benz-cars/news.html',
    website_url: 'https://www.mercedes-benz.com.vn' },
];

const ALL_COMPETITORS = [...NEWS_AGGREGATORS, ...MANUFACTURER_SOURCES];

async function seed() {
  console.log(`Seeding ${ALL_COMPETITORS.length} competitor records...`);

  // Xóa data cũ
  const { error: delErr } = await supabase
    .from('thaco_competitor_mapping')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.warn('Delete warning:', delErr.message);

  // Insert theo batch 20
  for (let i = 0; i < ALL_COMPETITORS.length; i += 20) {
    const batch = ALL_COMPETITORS.slice(i, i + 20);
    const { error } = await supabase.from('thaco_competitor_mapping').insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i + 20} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted ${Math.min(i + 20, ALL_COMPETITORS.length)}/${ALL_COMPETITORS.length}`);
  }

  console.log('Seed complete!');
}

seed();
