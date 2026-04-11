import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const envPath = 'E:/ANTIGRAVITY/03_INFRA_HA_TANG/.env.master';

const env = fs.readFileSync(envPath, 'utf8');

const url = env.match(/SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  console.log('1. Fetching HN Unit ID...');
  const { data: unitData, error: unitErr } = await supabase
    .from('thaco_units')
    .select('id')
    .eq('code', 'HN')
    .single();

  if (unitErr) throw unitErr;
  const unitId = unitData.id;

  console.log('2. Deleting corrupted records...');
  // Since we don't have constraints on showroom.id, it is safe.
  await supabase.from('thaco_showrooms').delete().eq('unit_id', unitId);

  console.log('3. Inserting proper showrooms...');
  const rows = [
    { unit_id: unitId, code: 'PVD', name: 'Phạm Văn Đồng', weight: 0.15, brands: [], is_active: true },
    { unit_id: unitId, code: 'DT', name: 'Đông Trù', weight: 0.10, brands: [], is_active: true },
    { unit_id: unitId, code: 'GP', name: 'Giải Phóng', weight: 0.12, brands: [], is_active: true },
    { unit_id: unitId, code: 'BD', name: 'Bạch Đằng', weight: 0.10, brands: [], is_active: true },
    { unit_id: unitId, code: 'NVC', name: 'Nguyễn Văn Cừ', weight: 0.12, brands: [], is_active: true },
    { unit_id: unitId, code: 'DAITU', name: 'Đài Tư', weight: 0.08, brands: [], is_active: true },
    { unit_id: unitId, code: 'BMWLB', name: 'BMW Long Biên', weight: 0.06, brands: [], is_active: true },
    { unit_id: unitId, code: 'LVL', name: 'Lê Văn Lương', weight: 0.06, brands: [], is_active: true },
    { unit_id: unitId, code: 'CM', name: 'Chương Mỹ', weight: 0.05, brands: [], is_active: true },
    { unit_id: unitId, code: 'HN', name: 'Hà Nam', weight: 0.08, brands: [], is_active: true },
    { unit_id: unitId, code: 'NB', name: 'Ninh Bình', weight: 0.08, brands: [], is_active: true }
  ];

  const { error: insErr } = await supabase.from('thaco_showrooms').insert(rows);
  if (insErr) {
    console.error('Insert error', insErr);
  } else {
    console.log('Done successfully!');
  }
}

run();
