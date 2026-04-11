/**
 * MASTER DATA & SYSTEM CONFIGS
 * ============================================================================
 * Đây là Source of Truth (Nguồn chân lý) cho mọi danh mục tĩnh của hệ thống.
 * Trước khi bảng Database tương ứng (thaco_master_*) được tạo trên Supabase,
 * Hệ thống sẽ đọc trực tiếp từ các Blueprint này để đảm bảo tính nhất quán (Consistency).
 * Tuyệt đối không hard-code (viết cứng) chuỗi ký tự rác rải rác trên giao diện.
 */

// 1. MASTER SHOWROOMS (Sẽ ánh xạ vào thaco_master_showrooms)
// Code: Mã định danh chuẩn (Business Code)
// Name: Tên hiển thị báo cáo
// Weight: Trọng số để tính Budget P&L (Phân bổ ngân sách tổng -> Chi nhánh)
export const MASTER_SHOWROOMS = [
  { code: 'PVD', name: 'Phạm Văn Đồng', region: 'HN', weight: 0.15 },
  { code: 'GP', name: 'Giải Phóng', region: 'HN', weight: 0.12 },
  { code: 'DT', name: 'Đông Trù', region: 'HN', weight: 0.10 },
  { code: 'PX', name: 'Phú Xuyên', region: 'HN', weight: 0.05 },
  { code: 'NVC', name: 'Nguyễn Văn Cừ', region: 'HN', weight: 0.12 },
  { code: 'TD', name: 'Trương Định', region: 'HN', weight: 0.10 },
  { code: 'HM', name: 'Hoàng Mai', region: 'HN', weight: 0.08 },
  { code: 'HN', name: 'Hà Nam', region: 'HN', weight: 0.08 },
  { code: 'DAITU', name: 'Đài Tư', region: 'HN', weight: 0.08 },
  { code: 'LBBMW', name: 'Long Biên (BMW)', region: 'HN', weight: 0.06 },
  { code: 'LVLBMW', name: 'Lê Văn Lương (BMW)', region: 'HN', weight: 0.06 }
];

export const DEMO_SHOWROOMS = MASTER_SHOWROOMS.map(s => s.name);

// 2. MASTER MODELS (Sẽ ánh xạ vào thaco_master_models)
export const MASTER_BRANDS = [
  {
    name: 'KIA',
    models: ['New Carnival', 'Sportage', 'Carens', 'New Sonet', 'New Seltos', 'New Sorento', 'Kia K5', 'New Morning', 'K3', 'Soluto'],
  },
  {
    name: 'Mazda',
    models: ['Mazda CX-5', 'CX-30', 'Mazda CX-8', 'Mazda3', 'Mazda2', 'Mazda CX-3', 'Mazda6', 'BT-50'],
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
  }
];

// 3. FALLBACK/DEMO KPI RATES
// LƯU Ý KIẾN TRÚC TỪ USER: Lập trình viên KHÔNG ĐƯỢC gán cứng (hardcode) các hằng số này
// làm System Configs cố định. Các chỉ số CPL, CR1, CR2 thực chất phải được nội suy (derive) 
// tự động từ CƠ SỞ DỮ LIỆU LỊCH SỬ. Ví dụ: CPL tháng 5 = (Tổng chi tháng 4) / (Tổng Leads tháng 4).
// Dữ liệu dưới đây chỉ là FALLBACK (số dự phòng) dùng khi Database Lịch sử chưa tích hợp đủ.
export const DEMO_KPI_RATES = {
  EVENT_CPL: 0.3,   // DỰ PHÒNG: 300k / KHQT
  EVENT_CR1: 0.3,   // DỰ PHÒNG: 30% KHQT -> GDTD
  EVENT_CR2: 0.25,  // DỰ PHÒNG: 25% GDTD -> KHĐ
};

// 4. BUSINESS CODE GENERATOR
// Hàm cấp mã Code tự động cho nghiệp vụ (Ví dụ Tạo Event) để dễ quản trị giao tiếp
export const generateBusinessCode = (showroomName: string, prefix: string = 'EV') => {
  // Lấy ra mã Showroom (vd: PVD), nếu không có lấy 3 ký tự đầu
  const srObj = MASTER_SHOWROOMS.find(s => s.name === showroomName);
  const srCode = srObj ? srObj.code : showroomName.substring(0, 3).toUpperCase();
  
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  
  // Random suffix tạm thời (khi lên DB thực sự sẽ dùng trigger Sequence SQL của PostgreSQL)
  const randomSuffix = Math.floor(Math.random() * 900 + 100); 
  
  // Format: EV-PVD-2604-839
  return `${prefix}-${srCode}-${yy}${mm}-${randomSuffix}`;
};
