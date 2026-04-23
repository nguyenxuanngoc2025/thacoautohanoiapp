// Database types for THACO MKT Budget

export type UserRole = 'super_admin' | 'pt_mkt_cty' | 'bld' | 'gd_showroom' | 'mkt_brand' | 'mkt_showroom' | 'finance';
export type EntryType = 'plan' | 'actual';
export type ApprovalStatus = 'draft' | 'pending_gd' | 'pending_bld' | 'approved' | 'rejected';
export type ChannelCategory = 'DIGITAL' | 'SỰ KIỆN' | 'CSKH' | 'NHẬN DIỆN';

// ─── Tổ chức ──────────────────────────────────────────────────────────────────

/** Công ty con (THACO AUTO HÀ NỘI, HẢI PHÒNG...) */
export interface Unit {
  id: string;
  code: string;      // 'HN', 'HP', 'HD', 'HCM'
  name: string;      // 'THACO AUTO HÀ NỘI'
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
}

/** Showroom thuộc Công ty */
export interface ThacShowroom {
  id: string;
  unit_id: string;
  code: string;      // 'PVD', 'GP', ...
  name: string;      // 'Phạm Văn Đồng'
  weight: number;    // tỷ trọng ngân sách (0–1)
  brands: string[];  // thương hiệu bán tại SR
  is_active: boolean;
  created_at: string;
  // Joined
  unit?: Unit;
}

/** User profile (extend Supabase auth.users) */
export interface ThacUser {
  id: string;              // = auth.users.id (UUID)
  unit_id: string | null;  // NULL = super_admin (xem tất cả công ty)
  showroom_id: string | null; // (legacy) giữ backward-compat. Phase 2 sẽ drop
  showroom_ids: string[];  // showroom CODES được gán (mkt_showroom/gd_showroom). [] = không gán
  brands: string[];        // brand names được phép (mkt_brand multi-brand). [] = tất cả
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  // Joined
  unit?: Unit;
  showroom?: ThacShowroom;
}

// ─── Legacy types (giữ cho backward compat) ───────────────────────────────────

/** @deprecated Dùng Unit thay thế */
export interface Organization {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

/** @deprecated Dùng ThacShowroom thay thế */
export interface Showroom {
  id: string;
  org_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
}

export interface VehicleModel {
  id: string;
  brand_id: string;
  name: string;
  sub_group: string | null;
  sort_order: number;
  is_active: boolean;
  brand?: Brand;
}

export interface ShowroomBrand {
  id: string;
  showroom_id: string;
  brand_id: string;
  showroom?: Showroom;
  brand?: Brand;
}

export interface Channel {
  id: string;
  org_id: string;
  name: string;
  category: ChannelCategory;
  sort_order: number;
  is_active: boolean;
}

export interface BudgetEntry {
  id: string;
  org_id: string;
  showroom_id: string;
  brand_id: string;
  vehicle_model_id: string | null;
  channel_id: string;
  year: number;
  month: number;
  week: number | null;
  entry_type: EntryType;
  budget_amount: number;
  khqt: number;
  gdtd: number;
  khd: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  showroom?: Showroom;
  brand?: Brand;
  vehicle_model?: VehicleModel;
  channel?: Channel;
}

export interface Approval {
  id: string;
  org_id: string;
  showroom_id: string;
  brand_id: string | null;
  year: number;
  month: number;
  status: ApprovalStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  gd_approved_by: string | null;
  gd_approved_at: string | null;
  gd_comment: string | null;
  bld_approved_by: string | null;
  bld_approved_at: string | null;
  bld_comment: string | null;
  created_at: string;
}

// ─── KPI Types ────────────────────────────────────────────────────────────────

export interface KPIMetrics {
  budget_amount: number;
  khqt: number;
  gdtd: number;
  khd: number;
  tlcd_khqt_gdtd: number | null;
  tlcd_gdtd_khd: number | null;
  tlcd_khqt_khd: number | null;
  cost_per_lead: number | null;
  cost_per_acquisition: number | null;
}

export interface PeriodFilter {
  year: number;
  month: number;
  week?: number | null;
}

export interface DashboardSummary {
  total_budget_plan: number;
  total_budget_actual: number;
  budget_utilization: number;
  total_khqt: number;
  total_gdtd: number;
  total_khd: number;
  avg_cpl: number | null;
  avg_cpa: number | null;
  avg_conversion: number | null;
}

// ─── Role Labels ──────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:  'Super Admin',
  pt_mkt_cty:   'PT Marketing Cty',
  bld:          'Ban Lãnh Đạo',
  gd_showroom:  'GĐ Showroom',
  mkt_brand:    'MKT Thương hiệu',
  mkt_showroom: 'MKT Showroom',
  finance:      'Kế Toán',
};

/** Đặc điểm chi tiết của từng role để hiển thị trong modal */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin:  'Quản trị toàn bộ hệ thống, quản lý tất cả công ty, tạo/xóa tài khoản',
  pt_mkt_cty:   'Quyền quản lý tương đương Admin nhưng chỉ trong phạm vi công ty được gán',
  bld:          'Xem toàn bộ dữ liệu công ty, phê duyệt kế hoạch ngân sách',
  gd_showroom:  'Xem và quản lý dữ liệu showroom của mình, phê duyệt cấp showroom',
  mkt_brand:    'Lập kế hoạch ngân sách và báo cáo theo thương hiệu được giao',
  mkt_showroom: 'Nhập liệu kế hoạch và báo cáo thực hiện tại showroom của mình',
  finance:      'Xem báo cáo tài chính, chi phí marketing toàn công ty',
};

/** Phạm vi truy cập dữ liệu của từng role */
export const ROLE_SCOPE: Record<UserRole, string> = {
  super_admin:  'Toàn hệ thống — tất cả công ty',
  pt_mkt_cty:   'Công ty được gán — toàn bộ showroom & thương hiệu',
  bld:          'Toàn hệ thống — chỉ xem, không sửa',
  gd_showroom:  'Nội bộ showroom của mình',
  mkt_brand:    'Thương hiệu được phân công (trong công ty)',
  mkt_showroom: 'Nội bộ showroom của mình',
  finance:      'Toàn công ty — chỉ module báo cáo & tài chính',
};

/** Quyền hạn chính của từng role */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin:  ['Tạo/sửa/xóa tài khoản', 'Xem tất cả công ty', 'Cấu hình hệ thống', 'Phê duyệt mọi cấp'],
  pt_mkt_cty:   ['Xem toàn bộ công ty đc gán', 'Quản lý ngân sách cty', 'Phê duyệt kế hoạch', 'Xuất báo cáo'],
  bld:          ['Xem toàn bộ dữ liệu', 'Phê duyệt kế hoạch', 'Xuất báo cáo tổng hợp'],
  gd_showroom:  ['Xem dữ liệu showroom', 'Phê duyệt cấp showroom', 'Xuất báo cáo showroom'],
  mkt_brand:    ['Lập kế hoạch thương hiệu', 'Nhập liệu thực tế', 'Xem báo cáo thương hiệu'],
  mkt_showroom: ['Nhập kế hoạch tháng', 'Nhập liệu thực tế', 'Xem báo cáo showroom'],
  finance:      ['Xem tất cả báo cáo tài chính', 'Xuất dữ liệu chi phí'],
};

/** Danh sách việc ĐƯỢC LÀM của từng role — dùng trong bảng tham chiếu và form tạo TK */
export const ROLE_CAN: Record<UserRole, string[]> = {
  super_admin:  ['Xem toàn bộ hệ thống', 'Tạo/sửa/xóa mọi tài khoản', 'Cấu hình hệ thống', 'Duyệt mọi cấp', 'Nhập liệu tất cả showroom', 'Chuyển đổi giữa các công ty'],
  pt_mkt_cty:   ['Xem toàn bộ công ty được gán', 'Tạo/sửa tài khoản trong đơn vị', 'Duyệt kế hoạch ngân sách', 'Nhập liệu tất cả showroom trong đơn vị', 'Xuất báo cáo'],
  bld:          ['Xem toàn bộ dữ liệu (chỉ đọc)', 'Duyệt kế hoạch', 'Xuất báo cáo tổng hợp'],
  gd_showroom:  ['Xem dữ liệu showroom của mình', 'Duyệt kế hoạch cấp showroom', 'Xem báo cáo showroom', 'Tạo/sửa sự kiện tại showroom'],
  mkt_brand:    ['Nhập kế hoạch ngân sách theo thương hiệu được giao', 'Nhập liệu thực tế', 'Tạo/sửa sự kiện', 'Xem báo cáo thương hiệu'],
  mkt_showroom: ['Nhập kế hoạch ngân sách tháng', 'Nhập liệu thực tế', 'Tạo/sửa sự kiện tại showroom', 'Xem báo cáo showroom'],
  finance:      ['Xem tất cả báo cáo tài chính (chỉ đọc)', 'Xuất dữ liệu chi phí'],
};

/** Danh sách việc KHÔNG ĐƯỢC LÀM của từng role */
export const ROLE_CANNOT: Record<UserRole, string[]> = {
  super_admin:  [],
  pt_mkt_cty:   ['Tạo tài khoản super_admin', 'Truy cập dữ liệu ngoài đơn vị được gán'],
  bld:          ['Nhập liệu', 'Sửa kế hoạch', 'Tạo/sửa sự kiện', 'Quản lý tài khoản'],
  gd_showroom:  ['Nhập liệu kế hoạch trực tiếp (chỉ duyệt)', 'Truy cập dữ liệu showroom khác', 'Quản lý tài khoản'],
  mkt_brand:    ['Nhập liệu thương hiệu không được giao', 'Duyệt kế hoạch', 'Quản lý tài khoản'],
  mkt_showroom: ['Truy cập dữ liệu showroom khác', 'Duyệt kế hoạch', 'Quản lý tài khoản'],
  finance:      ['Nhập liệu', 'Sửa kế hoạch', 'Tạo/sửa sự kiện', 'Quản lý tài khoản'],
};

/** Thông tin gán phạm vi cần thiết khi tạo tài khoản */
export const ROLE_NEEDS: Record<UserRole, { unit: boolean; showroom: boolean; brands: boolean; label: string }> = {
  super_admin:  { unit: false, showroom: false, brands: false, label: 'Không cần gán — truy cập toàn hệ thống' },
  pt_mkt_cty:   { unit: true,  showroom: false, brands: false, label: 'Gán đơn vị (Công ty)' },
  bld:          { unit: false, showroom: false, brands: false, label: 'Không cần gán — xem toàn hệ thống (chỉ đọc)' },
  gd_showroom:  { unit: true,  showroom: true,  brands: false, label: 'Gán đơn vị + Showroom phụ trách' },
  mkt_brand:    { unit: true,  showroom: false, brands: true,  label: 'Gán đơn vị + Thương hiệu phụ trách' },
  mkt_showroom: { unit: true,  showroom: true,  brands: false, label: 'Gán đơn vị + Showroom phụ trách' },
  finance:      { unit: false, showroom: false, brands: false, label: 'Không cần gán — xem toàn hệ thống (chỉ đọc)' },
};

/** Kiểm tra role có cần gán Showroom không */
export function roleNeedsShowroom(role: UserRole): boolean {
  return role === 'mkt_showroom' || role === 'gd_showroom';
}

/** Kiểm tra role có cần gán Brand không */
export function roleNeedsBrands(role: UserRole): boolean {
  return role === 'mkt_brand';
}

/** Kiểm tra role có quyền xem tất cả không */
export function roleIsAdmin(role: UserRole): boolean {
  return role === 'super_admin' || role === 'bld';
}

/** Kiểm tra role có phạm vi toàn công ty (không cần gán unit) */
export function roleIsCompanyWide(role: UserRole): boolean {
  return role === 'super_admin' || role === 'bld' || role === 'finance';
}

/** PT Marketing Cty — quyền admin trong công ty */
export function roleIsPtMktCty(role: UserRole): boolean {
  return role === 'pt_mkt_cty';
}

// ─── Foundation Rebuild: New Types ───────────────────────────────────────────

export interface MasterMetric {
  id: string;
  code: string;         // e.g. "NS", "KHQT", "GDTD", "KHD"
  name: string;         // e.g. "Ngân sách", "Khách hàng quan tâm"
  value_type: 'currency_million' | 'integer';
  decimals: number;     // 1 for NS, 0 for counts
  sort_order: number;
  is_active: boolean;
}

export interface BudgetEntryRow {
  id: string;
  unit_id: string;
  showroom_id: string;
  year: number;
  month: number;          // 1-12
  brand_name: string;
  model_name: string;
  channel_code: string;
  plan_ns: number | null;
  plan_khqt: number | null;
  plan_gdtd: number | null;
  plan_khd: number | null;
  actual_ns: number | null;
  actual_khqt: number | null;
  actual_gdtd: number | null;
  actual_khd: number | null;
  plan_source: string;
  actual_source: string;
  plan_status: 'draft' | 'submitted' | 'approved';
  actual_status: 'draft' | 'submitted' | 'approved';
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ViewBudgetByShowroom {
  unit_id: string;
  showroom_id: string;
  year: number;
  month: number;
  plan_ns: number;
  plan_khqt: number;
  plan_gdtd: number;
  plan_khd: number;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

export interface ViewBudgetByChannel {
  unit_id: string;
  channel_code: string;
  year: number;
  month: number;
  plan_ns: number;
  plan_khqt: number;
  plan_gdtd: number;
  plan_khd: number;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

export interface ViewBudgetByBrand {
  unit_id: string;
  brand_name: string;
  year: number;
  month: number;
  plan_ns: number;
  plan_khqt: number;
  plan_gdtd: number;
  plan_khd: number;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

export interface ViewBudgetByShowroomBrand {
  unit_id: string;
  showroom_id: string;
  brand_name: string;
  year: number;
  month: number;
  plan_ns: number;
  plan_khqt: number;
  plan_gdtd: number;
  plan_khd: number;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

export interface ViewBudgetMaster {
  unit_id: string;
  showroom_id: string;
  brand_name: string;
  model_name: string;
  channel_code: string;
  year: number;
  month: number;
  plan_ns: number;
  plan_khqt: number;
  plan_gdtd: number;
  plan_khd: number;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

export interface ViewKpiByShowroom {
  unit_id: string;
  showroom_id: string;
  year: number;
  month: number;
  ns: number;
  khqt: number;
  gdtd: number;
  khd: number;
  cpl: number | null;
  cr1_pct: number | null;
  cr2_pct: number | null;
}

// CellData key format: "brand_name|||model_name|||channel_code|||metric_code"
// Example: "KIA|||New Carnival|||FB|||ns"
export type CellDataKey = string;

export interface CellData {
  [key: CellDataKey]: number | null;
}
