import { createClient } from './supabase/client';

export type ActualPayload = Record<string, number>;
export type ActualNotes = Record<string, string>;

export interface ActualEntryData {
  id?: string;
  year: number;
  month: number;
  unit_id?: string;
  payload: ActualPayload;
  notes: ActualNotes;
  status: 'draft' | 'submitted' | 'approved';
  submitted_by?: string;
  submitted_at?: string;
}

export async function fetchActualEntry(month: number, year: number = 2026): Promise<ActualEntryData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_actual_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('Error fetching actual entry:', error);
    return null;
  }
  return data;
}

export async function upsertActualEntry(
  month: number,
  year: number,
  payload: ActualPayload,
  notes: ActualNotes,
  status: string = 'draft',
  unit_id?: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('thaco_actual_entries')
    .upsert({
      year,
      month,
      payload,
      notes,
      status,
      ...(unit_id && { unit_id }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'year,month' });

  if (error) {
    console.error('Error upserting actual entry:', error);
    return false;
  }
  return true;
}

/**
 * Tính CPL trung bình lịch sử theo kênh từ các tháng có actual data.
 * Trả về Record<channelName, avgCPL> — triệu VND / lead.
 * Kênh không có đủ data → không có entry (caller dùng fallback).
 */
export async function computeHistoricalCPL(year: number = 2026): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_actual_entries')
    .select('month, payload')
    .eq('year', year)
    .order('month');

  if (error || !data || data.length === 0) return {};

  const CHANNELS = ['Facebook', 'Google', 'Khác', 'CSKH', 'Nhận diện'];
  const acc: Record<string, { totalBudget: number; totalKHQT: number }> = {};
  for (const ch of CHANNELS) acc[ch] = { totalBudget: 0, totalKHQT: 0 };

  // Deduplicate: nếu cùng tháng có nhiều entries, chỉ lấy entry mới nhất (order by month, Supabase trả cuối cùng)
  const latestByMonth: Record<number, Record<string, number>> = {};
  for (const entry of data) {
    const payload = entry.payload as Record<string, number> | null;
    if (!payload) continue;
    latestByMonth[entry.month] = payload; // ghi đè → lấy entry cuối cùng của mỗi tháng
  }

  for (const payload of Object.values(latestByMonth)) {
    for (const ch of CHANNELS) {
      let budget = 0, khqt = 0;
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v !== 'number') continue;
        if (k.endsWith(`-${ch}-Ngân sách`)) budget += v;
        if (k.endsWith(`-${ch}-KHQT`)) khqt += v;
      }
      if (budget > 0 && khqt > 0) {
        acc[ch].totalBudget += budget;
        acc[ch].totalKHQT  += khqt;
      }
    }
  }

  // CPL = tổng ngân sách / tổng leads (weighted average đúng chuẩn thống kê)
  const result: Record<string, number> = {};
  for (const ch of CHANNELS) {
    if (acc[ch].totalKHQT > 0) {
      result[ch] = Math.round((acc[ch].totalBudget / acc[ch].totalKHQT) * 1000) / 1000;
    }
  }
  return result;
}

export async function fetchAllActualEntries(year: number = 2026): Promise<ActualEntryData[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_actual_entries')
    .select('*')
    .eq('year', year);
  if (error) {
    console.error('Error fetching all actual entries:', error);
    return [];
  }
  return data;
}

export async function submitActualEntry(
  month: number,
  year: number,
  submittedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('thaco_actual_entries')
    .update({
      status: 'submitted',
      submitted_by: submittedBy,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('year', year)
    .eq('month', month);

  if (error) {
    console.error('Error submitting actual entry:', error);
    return false;
  }
  return true;
}
