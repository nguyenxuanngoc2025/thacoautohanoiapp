import { createClient } from './supabase/client';

export type ActualPayload = Record<string, number>;
export type ActualNotes = Record<string, string>;

/** 1 record thực hiện = 1 showroom + 1 tháng */
export interface ActualEntryData {
  id?: string;
  year: number;
  month: number;
  unit_id?: string;
  showroom_code: string;
  payload: ActualPayload;
  notes: ActualNotes;
  status: 'draft' | 'submitted' | 'approved';
  submitted_by?: string;
  submitted_at?: string;
  updated_at?: string;
}

/**
 * @deprecated Foundation Rebuild 2026-04-22: thaco_actual_entries (JSONB) superseded by
 * thaco_budget_entries (normalized rows) with mode='actual'. New code should use
 * Foundation views + rpc_upsert_budget_entries with mode='actual'.
 * KEPT for: notifications-engine.ts, use-data.ts legacy hooks (useActualEntries).
 * Remove after those callers are migrated to Foundation Rebuild architecture.
 */
export async function fetchAllActualEntries(year: number = 2026, unit_id?: string): Promise<ActualEntryData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .select('*')
    .eq('year', year);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchAllActualEntries]', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Phase 1: Lấy actual data của 1 showroom (tất cả tháng trong năm).
 */
export async function fetchActualEntriesByShowroom(
  showroom_code: string,
  year: number = 2026,
  unit_id?: string
): Promise<ActualEntryData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .select('*')
    .eq('year', year)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchActualEntriesByShowroom]', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Phase 1: Aggregate view — CHỈ các record đã submitted/approved.
 */
export async function fetchAggregateActualEntries(
  showroom_codes: string[],
  year: number = 2026,
  unit_id?: string
): Promise<ActualEntryData[]> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .select('*')
    .eq('year', year);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }
  if (showroom_codes.length > 0) {
    query = query.in('showroom_code', showroom_codes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchAggregateActualEntries]', error);
    return [];
  }
  return (data || []).map(row => ({
    ...row,
    payload: row.payload || {},
    notes: row.notes || {},
  }));
}

/**
 * Upsert actual cho 1 showroom + 1 tháng.
 * Unique key: (year, month, unit_id, showroom_code)
 */
export async function upsertActualEntry(
  month: number,
  year: number,
  showroom_code: string,
  payload: ActualPayload,
  notes: ActualNotes,
  status: string = 'draft',
  unit_id?: string
): Promise<boolean> {
  if (!showroom_code || showroom_code === 'ALL') {
    console.error('[upsertActualEntry] showroom_code phải là SR cụ thể, không được "ALL"');
    return false;
  }

  const supabase = createClient();

  // Clean integer cho KHQT/GDTD/KHĐ
  const cleanPayload: ActualPayload = {};
  for (const [key, val] of Object.entries(payload)) {
    if (typeof val !== 'number' || isNaN(val)) continue;
    const isBudget = key.endsWith('-Ngân sách') || key.endsWith('-CPL');
    cleanPayload[key] = isBudget ? Math.round(val * 10) / 10 : Math.round(val);
  }

  const { error } = await supabase
    .from('thaco_actual_entries')
    .upsert({
      year,
      month,
      showroom_code,
      payload: cleanPayload,
      notes,
      status,
      ...(unit_id && { unit_id }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'year,month,unit_id,showroom_code' });

  if (error) {
    console.error('[upsertActualEntry]', error);
    return false;
  }
  return true;
}

/**
 * Submit — chốt số thực hiện của 1 showroom trong 1 tháng.
 */
export async function submitActualEntry(
  month: number,
  year: number,
  showroom_code: string,
  submittedBy: string,
  unit_id?: string
): Promise<boolean> {
  if (!showroom_code || showroom_code === 'ALL') return false;

  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .update({
      status: 'submitted',
      submitted_by: submittedBy,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('year', year)
    .eq('month', month)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { error } = await query;
  if (error) {
    console.error('[submitActualEntry]', error);
    return false;
  }
  return true;
}

/**
 * Phase 1: Đổi status cho 1 record (draft/submitted/approved). Dùng cho approve + unlock.
 */
export async function setActualEntryStatus(
  month: number,
  year: number,
  showroom_code: string,
  status: 'draft' | 'submitted' | 'approved',
  unit_id?: string
): Promise<boolean> {
  if (!showroom_code || showroom_code === 'ALL') return false;

  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('year', year)
    .eq('month', month)
    .eq('showroom_code', showroom_code);

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }

  const { error } = await query;
  if (error) {
    console.error('[setActualEntryStatus]', error);
    return false;
  }
  return true;
}

/**
 * Tính CPL trung bình lịch sử theo kênh của showroom (hoặc unit).
 * Phase 2 sẽ dùng cho goal-seek. Phase 1 giữ nguyên signature.
 */
export async function computeHistoricalCPL(
  year: number = 2026,
  unit_id?: string,
  showroom_code?: string
): Promise<Record<string, number>> {
  const supabase = createClient();
  let query = supabase
    .from('thaco_actual_entries')
    .select('month, payload, showroom_code')
    .eq('year', year)
    .order('month');

  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }
  if (showroom_code && showroom_code !== 'ALL') {
    query = query.eq('showroom_code', showroom_code);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return {};

  const CHANNELS = ['Facebook', 'Google', 'Khác', 'CSKH', 'Nhận diện'];
  const acc: Record<string, { totalBudget: number; totalKHQT: number }> = {};
  for (const ch of CHANNELS) acc[ch] = { totalBudget: 0, totalKHQT: 0 };

  for (const entry of data) {
    const payload = entry.payload as Record<string, number> | null;
    if (!payload) continue;
    for (const ch of CHANNELS) {
      let budget = 0, khqt = 0;
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v !== 'number') continue;
        if (k.endsWith(`-${ch}-Ngân sách`)) budget += v;
        if (k.endsWith(`-${ch}-KHQT`)) khqt += v;
      }
      if (budget > 0 && khqt > 0) {
        acc[ch].totalBudget += budget;
        acc[ch].totalKHQT += khqt;
      }
    }
  }

  const result: Record<string, number> = {};
  for (const ch of CHANNELS) {
    if (acc[ch].totalKHQT > 0) {
      result[ch] = Math.round((acc[ch].totalBudget / acc[ch].totalKHQT) * 1000) / 1000;
    }
  }
  return result;
}
