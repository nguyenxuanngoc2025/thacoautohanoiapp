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
export const MASTER_BRANDS = [
  {
    name: 'KIA',
    models: ['New Carnival', 'Sportage', 'Carens', 'New Sonet', 'New Seltos', 'New Sorento', 'Kia K5', 'New Morning', 'K3', 'Soluto'],
  },
  {
    name: 'Mazda',
    models: ['Mazda CX-5', 'CX-30', 'Mazda CX-8', 'Mazda3', 'Mazda2', 'CX-3', 'Mazda6', 'BT-50'],
  },
  {
    name: 'Peugeot',
    models: ['3008', '5008', '2008', '408'],
  },
  {
    name: 'BMW',
    models: ['Nhóm doanh số chính', 'Nhóm cao cấp', 'Nhóm xe gầm thấp', 'Nhóm xe gầm cao'],
  },
  {
    name: 'MINI',
    models: ['3-Cửa', '5-Cửa', 'Clubman', 'Countryman', 'Convertible'],
  },
  {
    name: 'TẢI BUS',
    models: ['Tải nhẹ', 'Tải trung', 'Tải nặng', 'Bus', 'TN ĐK BN', 'Tổng Tải', 'Tổng Bus'],
  },
  {
    name: 'BMW MTR',
    models: ['Nhóm xe hiện hữu', 'Nhóm xe mới'],
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
