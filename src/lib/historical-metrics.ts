// app/src/lib/historical-metrics.ts
import { createClient } from './supabase/client';

export interface HistoricalMetrics {
  /** Trung bình CPL (triệu VND / lead) của SR trong N tháng gần nhất */
  cpl: Record<string, number>;  // key = channel name, value = CPL avg
  /** CR1: tỉ lệ chuyển đổi KHQT -> GDTD */
  cr1: Record<string, number>;  // key = channel name, value = %
  /** CR2: tỉ lệ chuyển đổi GDTD -> KHĐ */
  cr2: Record<string, number>;  // key = channel name, value = %
  /** Số tháng có dữ liệu thực dùng để tính */
  monthsWithData: number;
}

/**
 * Trả về CPL/CR lịch sử của showroom trong N tháng gần nhất.
 * Nếu không đủ dữ liệu, fallback về default values.
 *
 * @param showroom_code - Mã SR (vd: 'PVD')
 * @param year - Năm hiện tại
 * @param currentMonth - Tháng hiện tại (1-12), query các tháng trước đó
 * @param lookbackMonths - Số tháng nhìn lại (mặc định 3)
 */
export async function fetchHistoricalMetrics(
  showroom_code: string,
  year: number,
  currentMonth: number,
  lookbackMonths: number = 3
): Promise<HistoricalMetrics> {
  const supabase = createClient();

  // Tính range tháng cần query
  const months: { year: number; month: number }[] = [];
  for (let i = 1; i <= lookbackMonths; i++) {
    let m = currentMonth - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m });
  }

  const monthsInYear = months.filter(m => m.year === year).map(m => m.month);
  if (monthsInYear.length === 0) return getDefaultMetrics();

  // Step A: Resolve showroom_id từ code
  const { data: srData } = await supabase
    .from('thaco_showrooms')
    .select('id')
    .eq('code', showroom_code.toUpperCase())
    .maybeSingle();

  if (!srData) return getDefaultMetrics();

  // Step B: Fetch actual entries từ thaco_budget_entries
  const { data, error } = await supabase
    .from('thaco_budget_entries')
    .select('month, channel_code, actual_ns, actual_khqt, actual_gdtd, actual_khd')
    .eq('year', year)
    .eq('showroom_id', srData.id)
    .in('month', monthsInYear)
    .gt('actual_ns', 0);

  if (error || !data || data.length === 0) return getDefaultMetrics();

  return computeMetrics(data);
}

interface BudgetEntryRow {
  month: number;
  channel_code: string;
  actual_ns: number;
  actual_khqt: number;
  actual_gdtd: number;
  actual_khd: number;
}

const DEFAULT_CPL_BY_CHANNEL: Record<string, number> = {
  facebook: 0.08, google: 0.12,
};
const DEFAULT_CR1 = 0.15;
const DEFAULT_CR2 = 0.25;

function computeMetrics(rows: BudgetEntryRow[]): HistoricalMetrics {
  const byChannel: Record<string, { ns: number; khqt: number; gdtd: number; khd: number }> = {};

  for (const row of rows) {
    const ch = row.channel_code.toLowerCase();
    if (!byChannel[ch]) byChannel[ch] = { ns: 0, khqt: 0, gdtd: 0, khd: 0 };
    byChannel[ch].ns   += row.actual_ns   || 0;
    byChannel[ch].khqt += row.actual_khqt || 0;
    byChannel[ch].gdtd += row.actual_gdtd || 0;
    byChannel[ch].khd  += row.actual_khd  || 0;
  }

  const cpl: Record<string, number> = {};
  const cr1: Record<string, number> = {};
  const cr2: Record<string, number> = {};

  for (const [ch, vals] of Object.entries(byChannel)) {
    cpl[ch] = vals.khqt > 0 ? vals.ns / vals.khqt : (DEFAULT_CPL_BY_CHANNEL[ch] ?? 0.15);
    cr1[ch] = vals.khqt > 0 && vals.gdtd >= 0 ? vals.gdtd / vals.khqt : DEFAULT_CR1;
    cr2[ch] = vals.gdtd > 0 ? vals.khd / vals.gdtd : DEFAULT_CR2;
  }

  return { cpl, cr1, cr2, monthsWithData: rows.length > 0 ? 1 : 0 };
}

function getDefaultMetrics(): HistoricalMetrics {
  return {
    cpl: {},   // caller sẽ dùng default per channel khi key không tồn tại
    cr1: {},
    cr2: {},
    monthsWithData: 0,
  };
}

/** Lấy CPL cho 1 channel cụ thể, fallback về defaultCpl */
export function getCPL(metrics: HistoricalMetrics, channel: string, defaultCpl = 15): number {
  return metrics.cpl[channel] ?? defaultCpl;
}

export function getCR1(metrics: HistoricalMetrics, channel: string, defaultCr1 = 0.4): number {
  return metrics.cr1[channel] ?? defaultCr1;
}

export function getCR2(metrics: HistoricalMetrics, channel: string, defaultCr2 = 0.25): number {
  return metrics.cr2[channel] ?? defaultCr2;
}
