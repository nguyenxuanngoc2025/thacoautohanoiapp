/**
 * MASTER DATA — FALLBACK ONLY
 * ============================================================================
 * ⚠️ CÁC HẰNG SỐ DƯỚI ĐÂY CHỈ LÀ FALLBACK khi DB chưa sẵn sàng.
 * SINGLE SOURCE OF TRUTH (SSOT) là Supabase DB:
 *   - Showrooms → thaco_showrooms (qua ShowroomsContext)
 *   - Brands/Models → thaco_master_brands + thaco_master_models (qua BrandsContext)
 *
 * KHÔNG được dùng MASTER_BRANDS hay MASTER_SHOWROOMS trong bất kỳ
 * logic tính toán nghiệp vụ nào (sync, planning, dashboard).
 * Chỉ dùng trong Context providers để cung cấp fallback khi DB timeout/error.
 */

// ─── 1. FALLBACK SHOWROOMS (chỉ dùng trong ShowroomsContext khi DB lỗi) ───────
export const MASTER_SHOWROOMS = [
  { code: 'PVD',    name: 'Phạm Văn Đồng',      region: 'HN', weight: 0.15 },
  { code: 'GP',     name: 'Giải Phóng',           region: 'HN', weight: 0.12 },
  { code: 'DT',     name: 'Đông Trù',             region: 'HN', weight: 0.10 },
  { code: 'PX',     name: 'Phú Xuyên',            region: 'HN', weight: 0.05 },
  { code: 'NVC',    name: 'Nguyễn Văn Cừ',        region: 'HN', weight: 0.12 },
  { code: 'TD',     name: 'Trương Định',           region: 'HN', weight: 0.10 },
  { code: 'HM',     name: 'Hoàng Mai',             region: 'HN', weight: 0.08 },
  { code: 'HN',     name: 'Hà Nam',                region: 'HN', weight: 0.08 },
  { code: 'DAITU',  name: 'Đài Tư',                region: 'HN', weight: 0.08 },
  { code: 'LBBMW',  name: 'Long Biên (BMW)',        region: 'HN', weight: 0.06 },
  { code: 'LVLBMW', name: 'Lê Văn Lương (BMW)',     region: 'HN', weight: 0.06 },
];

// ─── 2. FALLBACK BRANDS/MODELS (chỉ dùng trong BrandsContext khi DB lỗi) ─────
// Lưu ý: fallback không có aggregate rows — SSOT là DB với is_aggregate/aggregate_group
export const MASTER_BRANDS = [
  {
    name: 'KIA',
    models: ['New Carnival', 'Sportage', 'Carens', 'New Sonet', 'New Seltos', 'New Sorento', 'Kia K5', 'New Morning', 'K3', 'Soluto'],
  },
  {
    name: 'Mazda',
    models: ['CX-90', 'MX-5', 'Mazda CX-8', 'Mazda CX-5', 'Mazda3', 'CX-3', 'CX-30', 'Mazda2'],
  },
  {
    name: 'STELLANTIS',
    models: ['408', '2008', '3008', '5008'],
  },
  {
    name: 'BMW',
    models: [
      // Nhóm doanh số chính
      '3 Series (SK 2025, 2026)', 'X3 All New', '520i All New (SK 2025, 2026)', '4 Series (MSP)',
      // Nhóm cao cấp
      '530i All New (SK 2025, 2026)', '7 Series (SK 2025, 2026)', 'X7 (SK 2025, 2026)', 'M',
      // Nhóm Clear stock
      '3 Series (SK 2023, 2024)', 'X3 (SK 2024)', '520i CKD (SK 2022, 2023)', '530i CBU (SK 2022)',
      '520i All New (SK 2024)', '4 Series (GC)', '7 Series (SK 2023)', 'X7 (SK 2023)',
      'X5 LCI', 'X4 (SK 2023)', 'X6 (SK 2023)', 'Z4 (SK 2023)', 'iX3, i4, i7 (SK 2023, 2024)',
    ],
  },
  {
    name: 'MINI',
    models: ['Cooper 3 Cửa S', 'JCW 3 Cửa', 'Cooper 3 Cửa SE', 'Cooper 5 Cửa S', 'Cooper Mui trần S', 'Countryman S ALL4', 'JCW Countryman ALL4', 'Countryman SE ALL4', 'JCW Countryman'],
  },
  {
    name: 'TẢI BUS',
    models: ['Tải Van', 'Tải nhẹ máy xăng', 'Tải nhẹ máy dầu', 'Tải trung- Ben trung', 'Đầu kéo- Tải nặng- Ben nặng', 'Bus', 'Mini Bus'],
  },
  {
    name: 'DVPT XDL',
    models: ['Kia', 'Mazda', 'Stellantis', 'BMW'],
  },
  {
    name: 'DVPT Tải Bus',
    models: ['Tải', 'Bus'],
  },
  {
    name: 'BMW MTR',
    models: [
      // Nhóm xe hiện hữu
      'R 1250 RT', 'R 18', 'R NineT', 'R NineT SCR', 'S 1000 R', 'M 1000 R', 'F 900 XR', 'F 900 R',
      // Nhóm xe mới
      'R 1300 GS', 'R 1300 GSA', 'C 400 GT mới', 'S 1000 RR mới', 'S 1000 R mới',
    ],
  },
];

// ─── 3. FALLBACK KPI RATES (hằng số dự phòng — SSOT là lịch sử DB) ──────────
// LƯU Ý: CPL, CR1, CR2 thực chất phải được nội suy tự động từ dữ liệu lịch sử DB.
// Các giá trị dưới đây chỉ là dự phòng khi lịch sử chưa đủ.
export const DEMO_KPI_RATES = {
  EVENT_CPL: 0.3,   // DỰ PHÒNG: 300k / KHQT
  EVENT_CR1: 0.3,   // DỰ PHÒNG: 30% KHQT → GDTD
  EVENT_CR2: 0.25,  // DỰ PHÒNG: 25% GDTD → KHĐ
};

// ─── 4. BUSINESS CODE GENERATOR ───────────────────────────────────────────────
/**
 * Tạo mã code tự động cho nghiệp vụ (VD: Event).
 * @param showroomCode - Mã showroom (VD: 'PVD') — dùng trực tiếp, không cần lookup
 * @param prefix - Tiền tố mã (mặc định: 'EV')
 */
export const generateBusinessCode = (showroomCode: string, prefix: string = 'EV'): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  // Format: EV-PVD-2604-839
  return `${prefix}-${showroomCode.toUpperCase()}-${yy}${mm}-${randomSuffix}`;
};
