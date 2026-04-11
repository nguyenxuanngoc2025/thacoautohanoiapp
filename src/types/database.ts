// Database types for THACO MKT Budget

export type UserRole = 'super_admin' | 'bld' | 'gd_showroom' | 'mkt_brand' | 'mkt_showroom' | 'finance';
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
  is_active: boolean;
  created_at: string;
  // Joined
  unit?: Unit;
}

/** User profile (extend Supabase auth.users) */
export interface ThacUser {
  id: string;              // = auth.users.id (UUID)
  unit_id: string | null;  // NULL = super_admin (xem tất cả công ty)
  showroom_id: string | null; // NULL nếu không phải mkt_showroom/gd_showroom
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
  bld:          'Ban Lãnh Đạo',
  gd_showroom:  'GĐ Showroom',
  mkt_brand:    'MKT Thương hiệu',
  mkt_showroom: 'MKT Showroom',
  finance:      'Finance',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin:  'Quản trị toàn bộ hệ thống, tất cả công ty',
  bld:          'Xem toàn bộ dữ liệu công ty, phê duyệt kế hoạch',
  gd_showroom:  'Xem và quản lý dữ liệu showroom của mình',
  mkt_brand:    'Lập kế hoạch và báo cáo theo thương hiệu được giao',
  mkt_showroom: 'Nhập liệu và báo cáo tại showroom của mình',
  finance:      'Xem báo cáo tài chính toàn công ty',
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
