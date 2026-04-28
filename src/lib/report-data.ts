// app/src/lib/report-data.ts

export type PayloadMap = Record<string, number>;
export type MonthlyPayloads = Record<number, PayloadMap>;

export const REPORT_CHANNELS = ['Facebook', 'Google', 'Khác', 'CSKH', 'Nhận diện', 'Sự kiện'] as const;
export type ReportChannel = typeof REPORT_CHANNELS[number];

export const REPORT_METRICS = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'] as const;
export type ReportMetric = typeof REPORT_METRICS[number];

/** Tổng hợp payload theo tháng — có thể aggregate nhiều tháng */
export function mergePayloads(payloads: MonthlyPayloads, months: number[]): PayloadMap {
  const merged: PayloadMap = {};
  for (const m of months) {
    const p = payloads[m] ?? {};
    for (const [k, v] of Object.entries(p)) {
      merged[k] = (merged[k] ?? 0) + v;
    }
  }
  return merged;
}

/** Lấy danh sách showrooms từ payload keys */
export function extractShowrooms(payload: PayloadMap): string[] {
  const set = new Set<string>();
  for (const key of Object.keys(payload)) {
    const parts = key.split('-');
    if (parts.length >= 3) set.add(parts.slice(0, parts.length - 2).join('-'));
  }
  return [...set].sort();
}

/** Tổng giá trị theo kênh + metric */
export function sumByChannelMetric(
  payload: PayloadMap,
  channel: string,
  metric: string,
  showroom?: string
): number {
  let total = 0;
  for (const [k, v] of Object.entries(payload)) {
    const parts = k.split('-');
    if (parts.length < 3) continue;
    const m = parts[parts.length - 1];
    const ch = parts[parts.length - 2];
    const sr = parts.slice(0, parts.length - 2).join('-');
    if (ch === channel && m === metric) {
      if (!showroom || sr === showroom) total += v;
    }
  }
  return total;
}

/** Tổng theo tháng + kênh + metric (dùng cho Tab 1: pivot tháng) */
export function buildMonthlyChannelMatrix(
  plansByMonth: MonthlyPayloads,
  channel: string,
  metric: string,
  months: number[]
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const m of months) {
    result[m] = sumByChannelMetric(plansByMonth[m] ?? {}, channel, metric);
  }
  return result;
}

/** Tính CPL, CR1, CR2 từ payload */
export function computeChannelKPIs(payload: PayloadMap, channel: string, showroom?: string) {
  const ns   = sumByChannelMetric(payload, channel, 'Ngân sách', showroom);
  const khqt = sumByChannelMetric(payload, channel, 'KHQT', showroom);
  const gdtd = sumByChannelMetric(payload, channel, 'GDTD', showroom);
  const khd  = sumByChannelMetric(payload, channel, 'KHĐ', showroom);
  return {
    ns, khqt, gdtd, khd,
    cpl:  khqt > 0 ? +(ns / khqt).toFixed(2) : null,
    cr1:  khqt > 0 ? +(gdtd / khqt * 100).toFixed(1) : null,
    cr2:  gdtd > 0 ? +(khd / gdtd * 100).toFixed(1) : null,
  };
}

/** Months in a quarter */
export function monthsInQuarter(q: number): number[] {
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

/** Tổng theo thương hiệu + metric (sum tất cả model + channel) */
export function sumByBrandMetric(
  payload: PayloadMap,
  brand: string,
  metric: string
): number {
  let total = 0;
  for (const [k, v] of Object.entries(payload)) {
    const parts = k.split('-');
    if (parts.length < 3) continue;
    if (parts[0] === brand && parts[parts.length - 1] === metric) total += v;
  }
  return total;
}

/** Tổng theo model cụ thể + metric (sum tất cả channel) */
export function sumByModelMetric(
  payload: PayloadMap,
  brand: string,
  model: string,
  metric: string
): number {
  const prefix = `${brand}-${model}`;
  let total = 0;
  for (const [k, v] of Object.entries(payload)) {
    const parts = k.split('-');
    if (parts.length < 3) continue;
    const m  = parts[parts.length - 1];
    const sr = parts.slice(0, parts.length - 2).join('-');
    if (sr === prefix && m === metric) total += v;
  }
  return total;
}

/** Months in a period */
export function getMonthsForPeriod(
  viewMode: 'month' | 'quarter' | 'year',
  month: number
): number[] {
  if (viewMode === 'month') return [month];
  if (viewMode === 'quarter') return monthsInQuarter(Math.ceil(month / 3));
  return Array.from({ length: 12 }, (_, i) => i + 1);
}
