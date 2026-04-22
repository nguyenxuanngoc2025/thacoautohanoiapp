import { createClient } from './supabase/client';

/** Payload của 1 Showroom trong 1 tháng: { brandModel-channel-metric: number } */
export type BudgetPayload = Record<string, number>;
export type BudgetNotes = Record<string, string>;

/** 1 record kế hoạch = 1 showroom + 1 tháng. showroom_code bắt buộc sau Phase 1. */
export interface BudgetPlanData {
  id?: string;
  year: number;
  month: number;
  unit_id?: string;
  showroom_code: string;
  payload: BudgetPayload;
  notes: BudgetNotes;
  approval_status: 'draft' | 'submitted' | 'approved';
  updated_at?: string;
}

/**
 * @deprecated Foundation Rebuild 2026-04-22: thaco_budget_plans (JSONB) superseded by
 * thaco_budget_entries (normalized rows). New code should use fetchBudgetEntriesByShowroom
 * (lib/db/budget-entries.ts) + Supabase views (v_budget_by_showroom, v_budget_by_brand, etc.).
 * KEPT for: tasks/page.tsx, notifications-engine.ts, use-data.ts legacy hooks (useBudgetPlans).
 * Remove after those callers are migrated to Foundation Rebuild architecture.
 */
export async function fetchAllBudgetPlans(unit_id?: string, year: number = 2026): Promise<BudgetPlanData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_budget_plans')
    .select('*')
    .eq('year', year);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching budget plans:', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Phase 1: Lấy toàn bộ kế hoạch của 1 showroom (tất cả tháng trong năm).
 * Dùng cho view khi user đứng ở 1 SR cụ thể.
 */
export async function fetchBudgetPlansByShowroom(
  showroom_code: string,
  year: number = 2026,
  unit_id?: string
): Promise<BudgetPlanData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_budget_plans')
    .select('*')
    .eq('year', year)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchBudgetPlansByShowroom]', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Phase 1: Aggregate view — lấy data của nhiều SR, CHỈ các record đã submitted/approved.
 * Caller (planning page) tự sum. Trả nguyên mảng rows để UI biết SR nào đã nộp.
 *
 * @param showroom_codes Nếu [] = lấy tất cả SR trong unit (dùng cho admin/BLĐ)
 */
export async function fetchAggregateBudgetPlans(
  showroom_codes: string[],
  year: number = 2026,
  unit_id?: string
): Promise<BudgetPlanData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_budget_plans')
    .select('*')
    .eq('year', year);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  // Nếu showroom_codes không rỗng, lọc theo list; rỗng = tất cả SR trong unit
  if (showroom_codes.length > 0) {
    query = query.in('showroom_code', showroom_codes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchAggregateBudgetPlans]', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Upsert kế hoạch cho 1 showroom cụ thể trong 1 tháng.
 * Unique key: (year, month, unit_id, showroom_code)
 *
 * Phase 1: showroom_code === 'ALL' bị từ chối. Mọi save phải gắn SR thật.
 */
export async function upsertBudgetPlan(
  month: number,
  showroom_code: string,
  payload: BudgetPayload,
  notes: BudgetNotes,
  approval_status: string = 'draft',
  unit_id?: string,
  year: number = 2026
): Promise<boolean> {
  // Hard guard: Bottom-up architecture không cho ghi 'ALL'
  if (!showroom_code || showroom_code === 'ALL') {
    console.error('[upsertBudgetPlan] showroom_code phải là SR cụ thể, không được "ALL"');
    return false;
  }

  const supabase = createClient();

  // Làm tròn integer cho KHQT/GDTD/KHĐ, giữ decimal cho Ngân sách/CPL
  // Spec: "Con người" bắt buộc integer ngay tại lưu để tổng không lẻ
  const cleanPayload: BudgetPayload = {};
  for (const [key, val] of Object.entries(payload)) {
    if (typeof val !== 'number' || isNaN(val)) continue;
    const isBudget = key.endsWith('-Ngân sách') || key.endsWith('-CPL');
    cleanPayload[key] = isBudget ? Math.round(val * 10) / 10 : Math.round(val);
  }

  const { error } = await supabase
    .from('thaco_budget_plans')
    .upsert({
      month,
      year,
      showroom_code,
      payload: cleanPayload,
      notes,
      approval_status,
      ...(unit_id && { unit_id }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'year,month,unit_id,showroom_code' });

  if (error) {
    console.error('[upsertBudgetPlan]', error);
    return false;
  }
  return true;
}

/**
 * Phase 1: Đổi approval_status cho 1 record (draft → submitted → approved, hoặc ngược lại unlock).
 */
export async function setBudgetPlanStatus(
  month: number,
  showroom_code: string,
  status: 'draft' | 'submitted' | 'approved',
  unit_id?: string,
  year: number = 2026
): Promise<boolean> {
  if (!showroom_code || showroom_code === 'ALL') return false;

  const supabase = createClient();
  let query = supabase
    .from('thaco_budget_plans')
    .update({ approval_status: status, updated_at: new Date().toISOString() })
    .eq('year', year)
    .eq('month', month)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { error } = await query;
  if (error) {
    console.error('[setBudgetPlanStatus]', error);
    return false;
  }
  return true;
}

/**
 * Lấy kế hoạch của 1 showroom trong 1 tháng (lookup trực tiếp).
 * Vẫn giữ để caller dùng khi chỉ cần 1 record.
 */
export async function fetchBudgetPlanForShowroom(
  month: number,
  showroom_code: string,
  year: number = 2026,
  unit_id?: string
): Promise<BudgetPlanData | null> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_budget_plans')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[fetchBudgetPlanForShowroom]', error);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    payload: data.payload || {},
    notes: data.notes || {},
  };
}
