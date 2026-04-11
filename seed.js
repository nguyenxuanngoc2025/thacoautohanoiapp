
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];

const SHOWROOMS = [
  'Phạm Văn Đồng', 'Giải Phóng', 'Đông Trù', 'Phú Xuyên', 'Nguyễn Văn Cừ', 
  'Trương Định', 'Hoàng Mai', 'Hà Nam', 'Đài Tư', 'Long Biên (BMW)', 'Lê Văn Lương (BMW)'
];

const TYPES = ['Lái thử', 'Trưng bày', 'Sự kiện KH', 'Ra mắt sản phẩm', 'Workshop', 'Roadshow'];
const STATUSES = ['completed', 'in_progress', 'upcoming', 'overdue'];
const PRIORITIES = ['high', 'medium', 'low'];
const BRANDS = [
  ['KIA', 'New Carnival', 'Sportage'],
  ['Mazda', 'Mazda CX-5', 'CX-30'],
  ['Peugeot', '408', '2008', '5008'],
  ['BMW', 'Nhóm xe gầm cao'],
  ['MINI', '3-Cửa', '5-Cửa'],
  ['TẢI BUS', 'Tải nhẹ', 'Bus']
];
const OWNERS = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm Quỳnh D', 'Vũ Đức E', ''];

const LOCATIONS = [
  'Showroom chính', 'Aeon Mall Long Biên', 'Vincom Trần Duy Hưng', 
  'Sân vận động Mỹ Đình', 'Khu công nghiệp Đài Tư', 'KĐT Ecopark', ''
];

const NAMES = [
  'Sự kiện trải nghiệm xe cuối tuần',
  'Lái thử xe phong cách Châu Âu - Trải nghiệm đẳng cấp cùng Peugeot và BMW (Tên rất dài để test UI xuống dòng)',
  'Roadshow thu hút khách hàng tiềm năng',
  'Ra mắt dòng xe mới kết hợp tri ân khách hàng',
  'Workshop chăm sóc xe mùa mưa',
  'Trưng bày xe thương mại và xe tải nhẹ',
  'Ngày hội lái thử xe gầm cao chuyên dụng',
  'Trải nghiệm công nghệ Hybrid mới nhất',
  'Lễ bàn giao lô xe lớn cho đối tác chiến lược',
  'Sự kiện bốc thăm may mắn'
];

async function seedData() {
  console.log('🌱 Bắt đầu tạo dữ liệu giả lập (Seed Data)...');
  
  // Create 30 mock events
  const eventsToInsert = [];
  let baseId = Date.now();
  
  for (let i = 0; i < 35; i++) {
    const isCompleted = Math.random() > 0.6;
    const isOverdue = !isCompleted && Math.random() > 0.8;
    const status = isCompleted ? 'completed' : (isOverdue ? 'overdue' : randomItem(['in_progress', 'upcoming']));
    
    // Budget between 10m and 150m
    const budget = randomInt(5, 150);
    // Rough leads calculation (simulate Event CPL ~ 0.3)
    const leads = Math.round(budget / 0.3);
    const gdtd = Math.round(leads * 0.3);
    const deals = Math.round(gdtd * 0.25);
    const testDrives = Math.round(leads * 0.8);
    
    const month = randomInt(3, 6); // Months 3 to 6
    const day = String(randomInt(1, 28)).padStart(2, '0');
    const dateStr = `${day}/0${month}/2026`;
    
    const event = {
      id: baseId++,
      showroom: randomItem(SHOWROOMS),
      name: randomItem(NAMES),
      type: randomItem(TYPES),
      date: dateStr,
      location: randomItem(LOCATIONS),
      brands: randomItem(BRANDS),
      budget: budget,
      leads: leads,
      gdtd: gdtd,
      deals: deals,
      test_drives: testDrives,
      status: status,
      priority: randomItem(PRIORITIES),
      owner: randomItem(OWNERS),
      notes: Math.random() > 0.5 ? 'Ghi chú tự động sinh từ Seeder. Cần kiểm tra kỹ trước khi duyệt.' : ''
    };
    
    // Add actuals if completed or in_progress
    if (status === 'completed' || status === 'in_progress') {
      const variance = randomInt(70, 110) / 100; // 70% to 110% of plan
      event.budget_spent = Math.round(budget * variance * 10) / 10;
      event.leads_actual = Math.round(leads * variance);
      event.gdtd_actual = Math.round(gdtd * variance);
      event.deals_actual = Math.round(deals * variance);
      event.test_drives_actual = Math.round(testDrives * variance);
      
      // End date for completed
      if (status === 'completed') {
        event.end_date = `${String(Math.min(28, parseInt(day) + randomInt(1, 4))).padStart(2, '0')}/0${month}/2026`;
      }
    }
    
    eventsToInsert.push(event);
  }

  const { data, error } = await supabase
    .from('thacohn_events')
    .upsert(eventsToInsert);

  if (error) {
    console.error('❌ Lỗi khi insert data:', error);
  } else {
    console.log(`✅ Đã nạp thành công 35 events đa dạng vào Supabase!`);
  }
}

seedData();
