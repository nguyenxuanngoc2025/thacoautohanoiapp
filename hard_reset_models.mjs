import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://studio.ngocnguyenxuan.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMjUyMDAsImV4cCI6MTkyOTg5MTYwMH0.EswkDe7Zm8fNHw2pc08qoDYz5ahrk8koVHydLDQQSYU');

const data = {
  "KIA": [
    { n: "New Canrival" }, // Note: Intentional spelling from user 'New Canrival'
    { n: "Sportage" },
    { n: "Carens" },
    { n: "New Sonet" },
    { n: "New Seltos" },
    { n: "New Sorento" },
    { n: "Kia K5" },
    { n: "New Morning" },
    { n: "K3" },
    { n: "Soluto" }
  ],
  "Mazda": [
    { n: "CX-90" },
    { n: "MX-5" },
    { n: "Mazda CX-8" },
    { n: "Mazda CX-5" },
    { n: "Mazda3" },
    { n: "CX-3" },
    { n: "CX-30" },
    { n: "Mazda2" }
  ],
  "STELLANTIS": [
    { n: "408" },
    { n: "2008" },
    { n: "3008" },
    { n: "5008" }
  ],
  "BMW": [
    { n: "3 Series (SK 2025, 2026)" },
    { n: "X3 All New" },
    { n: "520i All New (SK 2025, 2026)" },
    { n: "4 Series (MSP)" },
    { n: "Tổng nhóm doanh số chính", isAgg: true, agg: "TONG_BMW_DS" },
    { n: "530i All New (SK 2025, 2026)" },
    { n: "7 Series (SK 2025, 2026)" },
    { n: "X7 (SK 2025, 2026)" },
    { n: "M" },
    { n: "Tổng nhóm cao cấp", isAgg: true, agg: "TONG_BMW_CC" },
    { n: "3 Series (SK 2023, 2024)" },
    { n: "X3 (SK 2024)" },
    { n: "520i CKD (SK 2022, 2023)" },
    { n: "530i CBU (SK 2022)" },
    { n: "520i All New (SK 2024)" },
    { n: "4 Series (GC)" },
    { n: "7 Series (SK 2023)" },
    { n: "X7 (SK 2023)" },
    { n: "X5 LCI" },
    { n: "X4 (SK 2023)" },
    { n: "X6 (SK 2023)" },
    { n: "Z4 (SK 2023)" },
    { n: "iX3, i4, i7 (SK 2023, 2024)" },
    { n: "Tổng GKL +", isAgg: true, agg: "TONG_BMW_GKL" }
  ],
  "MINI": [
    { n: "Cooper 3 Cửa S" },
    { n: "JCW 3 Cửa" },
    { n: "Cooper 3 Cửa SE" },
    { n: "Cooper 5 Cửa S" },
    { n: "Cooper Mui trần S" },
    { n: "Countryman S ALL4" },
    { n: "JCW Countryman ALL4" },
    { n: "Countryman SE ALL4" },
    { n: "JCW Countryman" }
  ],
  "TẢI BUS": [
    { n: "Tải Van" },
    { n: "Tải nhẹ máy xăng" },
    { n: "Tải nhẹ máy dầu" },
    { n: "Tải trung- Ben trung" },
    { n: "Đầu kéo- Tải nặng- Ben nặng" },
    { n: "Tổng Tải", isAgg: true, agg: "TONG_TAI" },
    { n: "Bus" },
    { n: "Mini Bus" },
    { n: "Tổng Bus", isAgg: true, agg: "TONG_BUS" }
  ],
  "DVPT XDL": [
    { n: "Kia" },
    { n: "Mazda" },
    { n: "Stellantis" },
    { n: "BMW" },
    { n: "Tổng", isAgg: true, agg: "TONG" }
  ],
  "DVPT Tải Bus": [
    { n: "Tải" },
    { n: "Bus" },
    { n: "Tổng", isAgg: true, agg: "TONG" }
  ]
};

async function run() {
  console.log('Clearing ALL old model data...');
  const { error: delErr } = await supabase.from('thacohn_master_models').delete().neq('id', -1);
  if (delErr) {
    console.error('Error deleting models:', delErr);
    return;
  }
  
  let insertedCount = 0;
  for (const brand of Object.keys(data)) {
    const models = data[brand];
    for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const res = await supabase.from('thacohn_master_models').insert({
            brand_name: brand,
            name: m.n,
            sort_order: i + 1,
            is_active: true,
            is_aggregate: m.isAgg || false,
            aggregate_group: m.agg || null
        });
        if (res.error) console.error(res.error);
        else insertedCount++;
    }
  }
  
  console.log('Successfully inserted', insertedCount, 'models across', Object.keys(data).length, 'brands.');
}

run();
