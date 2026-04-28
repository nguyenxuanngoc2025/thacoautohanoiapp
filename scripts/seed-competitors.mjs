// scripts/seed-competitors.mjs
// Seed thaco_competitors từ dữ liệu spreadsheet
// Usage: node scripts/seed-competitors.mjs

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMPETITORS = [
  // ── KIA ─────────────────────────────────────────────────────────────────────
  { thaco_brand: 'KIA', thaco_model: 'New Carnival', segment: 'MPV cao cấp',
    comp_brand: 'Volkswagen', comp_model: 'Viloran',
    news_url: 'https://vwlongbien.vn/chuong-trinh-khuyen-mai-hap-dan-danh-cho-cac-dong-xe-volkswagen/',
    website_url: 'https://vwlongbien.vn/san-pham/viloran/' },

  { thaco_brand: 'KIA', thaco_model: 'Sportage', segment: 'SUV cỡ C',
    comp_brand: 'Hyundai', comp_model: 'Tucson',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/san-pham/tucson' },

  { thaco_brand: 'KIA', thaco_model: 'Carens', segment: 'MPV 7 chỗ',
    comp_brand: 'Mitsubishi', comp_model: 'Xpander',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn/newxpander' },
  { thaco_brand: 'KIA', thaco_model: 'Carens', segment: 'MPV 7 chỗ',
    comp_brand: 'Toyota', comp_model: 'Veloz',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/veloz-cross-cvt' },
  { thaco_brand: 'KIA', thaco_model: 'Carens', segment: 'MPV 7 chỗ',
    comp_brand: 'Honda', comp_model: 'BR-V',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/18' },

  { thaco_brand: 'KIA', thaco_model: 'New Sonet', segment: 'SUV cỡ A',
    comp_brand: 'Toyota', comp_model: 'Raize',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/raize' },
  { thaco_brand: 'KIA', thaco_model: 'New Sonet', segment: 'SUV cỡ A',
    comp_brand: 'Hyundai', comp_model: 'Venue',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/san-pham/venue' },

  { thaco_brand: 'KIA', thaco_model: 'New Seltos', segment: 'SUV cỡ B',
    comp_brand: 'Hyundai', comp_model: 'Creta',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/san-pham/new-creta' },
  { thaco_brand: 'KIA', thaco_model: 'New Seltos', segment: 'SUV cỡ B',
    comp_brand: 'Mitsubishi', comp_model: 'Xforce',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn/xforce' },

  { thaco_brand: 'KIA', thaco_model: 'New Sorento', segment: 'SUV cỡ D',
    comp_brand: 'Hyundai', comp_model: 'SantaFe',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/san-pham/santa-fe' },
  { thaco_brand: 'KIA', thaco_model: 'New Sorento', segment: 'SUV cỡ D',
    comp_brand: 'Toyota', comp_model: 'Fortuner',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/fortuner-2-4at-4x2' },
  { thaco_brand: 'KIA', thaco_model: 'New Sorento', segment: 'SUV cỡ D',
    comp_brand: 'Ford', comp_model: 'Everest',
    news_url: 'https://www.ford.com.vn/showroom/all-offers',
    website_url: 'https://www.ford.com.vn/showroom/suvs/ford-everest/' },

  { thaco_brand: 'KIA', thaco_model: 'Kia K5', segment: 'Sedan cỡ D',
    comp_brand: 'Toyota', comp_model: 'Camry',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/camry-ce' },
  { thaco_brand: 'KIA', thaco_model: 'Kia K5', segment: 'Sedan cỡ D',
    comp_brand: 'Honda', comp_model: 'Civic',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/19' },

  { thaco_brand: 'KIA', thaco_model: 'New Morning', segment: 'Hatchback cỡ A',
    comp_brand: 'Hyundai', comp_model: 'Grand i10',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/new-grand-i10' },
  { thaco_brand: 'KIA', thaco_model: 'New Morning', segment: 'Hatchback cỡ A',
    comp_brand: 'Toyota', comp_model: 'Wigo',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/wigo-g' },

  { thaco_brand: 'KIA', thaco_model: 'K3', segment: 'Sedan cỡ C',
    comp_brand: 'Hyundai', comp_model: 'Elantra',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/elantra' },

  { thaco_brand: 'KIA', thaco_model: 'Soluto', segment: 'Sedan cỡ B',
    comp_brand: 'Hyundai', comp_model: 'Accent',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/all-new-accent' },

  // ── MAZDA ────────────────────────────────────────────────────────────────────
  { thaco_brand: 'Mazda', thaco_model: 'Mazda CX-8', segment: 'SUV cỡ D 3 hàng',
    comp_brand: 'Honda', comp_model: 'CR-V',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/17' },

  { thaco_brand: 'Mazda', thaco_model: 'Mazda CX-5', segment: 'SUV cỡ C',
    comp_brand: 'Ford', comp_model: 'Territory',
    news_url: 'https://www.ford.com.vn/showroom/all-offers/',
    website_url: 'https://www.ford.com.vn/showroom/suvs/ford-territory/' },
  { thaco_brand: 'Mazda', thaco_model: 'Mazda CX-5', segment: 'SUV cỡ C',
    comp_brand: 'Mitsubishi', comp_model: 'Destinator',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn/destinator' },
  { thaco_brand: 'Mazda', thaco_model: 'Mazda CX-5', segment: 'SUV cỡ C',
    comp_brand: 'Toyota', comp_model: 'Corolla Cross HV',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/corolla-cross-1-8hev' },

  { thaco_brand: 'Mazda', thaco_model: 'Mazda3', segment: 'Sedan cỡ C',
    comp_brand: 'Toyota', comp_model: 'Altis',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/corolla-altis-1-8g' },
  { thaco_brand: 'Mazda', thaco_model: 'Mazda3', segment: 'Sedan cỡ C',
    comp_brand: 'Honda', comp_model: 'Civic',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/19' },

  { thaco_brand: 'Mazda', thaco_model: 'CX-3', segment: 'SUV cỡ B',
    comp_brand: 'Toyota', comp_model: 'Yaris Cross',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/yaris-cross' },

  { thaco_brand: 'Mazda', thaco_model: 'CX-30', segment: 'SUV cỡ B+',
    comp_brand: 'Toyota', comp_model: 'Corolla Cross V',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/corolla-cross-1-8v' },
  { thaco_brand: 'Mazda', thaco_model: 'CX-30', segment: 'SUV cỡ B+',
    comp_brand: 'Honda', comp_model: 'HR-V',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/21' },

  { thaco_brand: 'Mazda', thaco_model: 'Mazda2', segment: 'Sedan cỡ B',
    comp_brand: 'Toyota', comp_model: 'Vios',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/vios-1-5e-cvt' },
  { thaco_brand: 'Mazda', thaco_model: 'Mazda2', segment: 'Sedan cỡ B',
    comp_brand: 'Honda', comp_model: 'City',
    news_url: 'https://www.honda.com.vn/o-to/khuyen-mai',
    website_url: 'https://www.honda.com.vn/o-to/chi-tiet/2' },

  // ── STELLANTIS ───────────────────────────────────────────────────────────────
  { thaco_brand: 'Stellantis', thaco_model: '408', segment: 'Sedan cỡ D',
    comp_brand: 'Toyota', comp_model: 'Camry',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn/' },
  { thaco_brand: 'Stellantis', thaco_model: '408', segment: 'Sedan cỡ D',
    comp_brand: 'Honda', comp_model: 'Civic',
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to' },

  { thaco_brand: 'Stellantis', thaco_model: '2008', segment: 'SUV cỡ B',
    comp_brand: 'Honda', comp_model: 'HR-V',
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to' },
  { thaco_brand: 'Stellantis', thaco_model: '2008', segment: 'SUV cỡ B',
    comp_brand: 'Mitsubishi', comp_model: 'Xforce',
    news_url: 'https://www.mitsubishi-motors.com.vn/khuyen-mai',
    website_url: 'https://www.mitsubishi-motors.com.vn/' },

  { thaco_brand: 'Stellantis', thaco_model: '3008', segment: 'SUV cỡ C',
    comp_brand: 'Toyota', comp_model: 'Corolla Cross',
    news_url: 'https://www.toyota.com.vn/tin-tuc/khuyen-mai',
    website_url: 'https://www.toyota.com.vn' },
  { thaco_brand: 'Stellantis', thaco_model: '3008', segment: 'SUV cỡ C',
    comp_brand: 'Hyundai', comp_model: 'Tucson',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/' },
  { thaco_brand: 'Stellantis', thaco_model: '3008', segment: 'SUV cỡ C',
    comp_brand: 'Ford', comp_model: 'Territory',
    news_url: 'https://www.ford.com.vn/about/news/',
    website_url: 'https://www.ford.com.vn/' },

  { thaco_brand: 'Stellantis', thaco_model: '5008', segment: 'SUV cỡ D',
    comp_brand: 'Hyundai', comp_model: 'SantaFe',
    news_url: 'https://hyundai.thanhcong.vn/htv/tin-cong-ty',
    website_url: 'https://hyundai.thanhcong.vn/' },
  { thaco_brand: 'Stellantis', thaco_model: '5008', segment: 'SUV cỡ D',
    comp_brand: 'Honda', comp_model: 'CR-V',
    news_url: 'https://www.honda.com.vn/o-to/tin-tuc',
    website_url: 'https://www.honda.com.vn/o-to' },

  // ── TẢI ──────────────────────────────────────────────────────────────────────
  { thaco_brand: 'Tải', thaco_model: 'Tải Van', segment: 'Tải Van',
    comp_brand: 'Suzuki', news_url: 'https://suzuki.com.vn/', website_url: 'https://suzuki.com.vn/', facebook_url: 'https://www.facebook.com/VietnamAutoSuzuki/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải Van', segment: 'Tải Van',
    comp_brand: 'TERACO', news_url: 'https://teraco.vn/', website_url: 'https://teraco.vn/', facebook_url: 'https://www.facebook.com/Vietthanglongauto/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải Van', segment: 'Tải Van',
    comp_brand: 'Do Thanh', news_url: 'https://dothanhauto.com/', website_url: 'https://dothanhauto.com/', facebook_url: 'https://www.facebook.com/Dothanh.Auto.VN' },
  { thaco_brand: 'Tải', thaco_model: 'Tải Van', segment: 'Tải Van',
    comp_brand: 'Vinfast', comp_model: 'EC Van', news_url: 'https://vinfastcaron.vn/product/ec-van/', website_url: 'https://vinfastcaron.vn/product/ec-van/', facebook_url: 'https://www.facebook.com/VinFastAuto.Official' },

  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy xăng', segment: 'Tải nhẹ máy xăng',
    comp_brand: 'Suzuki', news_url: 'https://suzuki.com.vn/', website_url: 'https://suzuki.com.vn/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy xăng', segment: 'Tải nhẹ máy xăng',
    comp_brand: 'Shineray', news_url: 'https://srmmotors.vn/', website_url: 'https://srmmotors.vn/', facebook_url: 'https://www.facebook.com/srmmotors.vn/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy xăng', segment: 'Tải nhẹ máy xăng',
    comp_brand: 'TERACO', news_url: 'https://daehan.vn/', website_url: 'https://daehan.vn/', facebook_url: 'https://www.facebook.com/daehanmotorsofficial' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy xăng', segment: 'Tải nhẹ máy xăng',
    comp_brand: 'Do Thanh', news_url: 'https://dothanhauto.com/', website_url: 'https://dothanhauto.com/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy xăng', segment: 'Tải nhẹ máy xăng',
    comp_brand: 'Foton', news_url: 'https://foton-dcc.vn/', website_url: 'https://foton-dcc.vn/', facebook_url: 'https://www.facebook.com/FotonMotor/' },

  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy dầu', segment: 'Tải nhẹ máy dầu',
    comp_brand: 'Hyundai', news_url: 'https://hyundaidongnam.com.vn/', website_url: 'https://hyundaidongnam.com.vn/', facebook_url: 'https://www.facebook.com/hyundaidongnamjsc' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy dầu', segment: 'Tải nhẹ máy dầu',
    comp_brand: 'TERACO', news_url: 'https://daehan.vn/tai-nhe-teraco', website_url: 'https://daehan.vn/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải nhẹ máy dầu', segment: 'Tải nhẹ máy dầu',
    comp_brand: 'Do Thanh', news_url: 'https://xetaidothanh.vn/', website_url: 'https://xetaidothanh.vn/' },

  { thaco_brand: 'Tải', thaco_model: 'Tải trung - Ben trung', segment: 'Tải trung',
    comp_brand: 'Hyundai', news_url: 'https://hyundaidongnam.com.vn/', website_url: 'https://hyundaidongnam.com.vn/' },
  { thaco_brand: 'Tải', thaco_model: 'Tải trung - Ben trung', segment: 'Tải trung',
    comp_brand: 'Isuzu', news_url: 'https://isuzu-vietnam.com/', website_url: 'https://isuzu-vietnam.com/', facebook_url: 'https://www.facebook.com/IsuzuVietnamCompany' },
  { thaco_brand: 'Tải', thaco_model: 'Tải trung - Ben trung', segment: 'Tải trung',
    comp_brand: 'Hino', news_url: 'https://hino.vn/', website_url: 'https://hino.vn/', facebook_url: 'https://www.facebook.com/hinomotorsvietnam.official' },
  { thaco_brand: 'Tải', thaco_model: 'Tải trung - Ben trung', segment: 'Tải trung',
    comp_brand: 'TMT', news_url: 'https://tmt-vietnam.com/su-kien-khuyen-mai/', website_url: 'https://tmt-vietnam.com/', facebook_url: 'https://www.facebook.com/TMTmotorsoffical' },

  { thaco_brand: 'Tải', thaco_model: 'Đầu kéo - Tải nặng - Ben nặng', segment: 'Đầu kéo - Tải nặng',
    comp_brand: 'Isuzu', news_url: 'https://isuzu-vietnam.com/', website_url: 'https://isuzu-vietnam.com/' },
  { thaco_brand: 'Tải', thaco_model: 'Đầu kéo - Tải nặng - Ben nặng', segment: 'Đầu kéo - Tải nặng',
    comp_brand: 'Hino', news_url: 'https://hino.vn/', website_url: 'https://hino.vn/' },
  { thaco_brand: 'Tải', thaco_model: 'Đầu kéo - Tải nặng - Ben nặng', segment: 'Đầu kéo - Tải nặng',
    comp_brand: 'TMT', news_url: 'https://tmt-vietnam.com/su-kien-khuyen-mai/', website_url: 'https://tmt-vietnam.com/' },

  // ── BUS ───────────────────────────────────────────────────────────────────────
  { thaco_brand: 'Bus', thaco_model: 'Bus', segment: 'Xe Bus',
    comp_brand: 'SAMCO', news_url: 'https://samco.com.vn/', website_url: 'https://samco.com.vn/', facebook_url: 'https://www.facebook.com/samco.vn/' },
  { thaco_brand: 'Bus', thaco_model: 'Bus', segment: 'Xe Bus',
    comp_brand: 'Kim Long', news_url: 'https://kimlongmotor.vn/', website_url: 'https://kimlongmotor.vn/', facebook_url: 'https://www.facebook.com/kimlongmotor.com.vn' },
  { thaco_brand: 'Bus', thaco_model: 'Bus', segment: 'Xe Bus',
    comp_brand: 'Vinfast', comp_model: 'VinBus',
    news_url: 'https://vinfastcaron.vn/product/ebus/', website_url: 'https://vinfastcaron.vn/product/ebus/', facebook_url: 'https://www.facebook.com/VinFastAuto.Official' },

  { thaco_brand: 'Bus', thaco_model: 'Mini Bus', segment: 'Mini Bus',
    comp_brand: 'SAMCO', news_url: 'https://samco.com.vn/', website_url: 'https://samco.com.vn/' },
  { thaco_brand: 'Bus', thaco_model: 'Mini Bus', segment: 'Mini Bus',
    comp_brand: 'Kim Long', news_url: 'https://kimlongmotor.vn/', website_url: 'https://kimlongmotor.vn/' },
];

async function seed() {
  console.log(`Seeding ${COMPETITORS.length} competitor records...`);
  // Xóa data cũ trước
  const { error: delErr } = await supabase.from('thaco_competitors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.warn('Delete warning:', delErr.message);

  const { data, error } = await supabase.from('thaco_competitors').insert(COMPETITORS);
  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
  console.log('Seed complete!');
}

seed();
