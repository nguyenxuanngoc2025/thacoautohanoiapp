// app/src/lib/goal-seek-engine.ts
import { getCPL, getCR1, getCR2, type HistoricalMetrics } from './historical-metrics';

export type GoalSeekMetric = 'ns' | 'khqt' | 'gdtd' | 'khd';

export interface GoalSeekInput {
  /** Chỉ số người dùng vừa nhập */
  metric: GoalSeekMetric;
  /** Giá trị người dùng nhập vào */
  value: number;
  /** Channel đang thao tác (vd: 'Google') */
  channel: string;
  /** Historical metrics của SR hiện tại */
  historicalMetrics: HistoricalMetrics;
}

export interface GoalSeekResult {
  ns: number;
  khqt: number;
  gdtd: number;
  khd: number;
}

/**
 * Tính goal-seek: từ 1 chỉ số đầu vào, suy ra 3 chỉ số còn lại.
 *
 * Công thức:
 *   CPL = NS / KHQT  →  NS = KHQT × CPL
 *   CR1 = GDTD / KHQT  →  GDTD = KHQT × CR1
 *   CR2 = KHĐ / GDTD   →  KHĐ  = GDTD × CR2
 *
 * Quy tắc làm tròn:
 *   - NS: 1 chữ số thập phân (Math.round(x * 10) / 10)
 *   - KHQT, GDTD, KHĐ: số nguyên (Math.round)
 */
export function goalSeek(input: GoalSeekInput): GoalSeekResult {
  const { metric, value, channel, historicalMetrics } = input;
  const cpl  = getCPL(historicalMetrics, channel);
  const cr1  = getCR1(historicalMetrics, channel);
  const cr2  = getCR2(historicalMetrics, channel);

  let ns: number, khqt: number, gdtd: number, khd: number;

  switch (metric) {
    case 'ns':
      ns   = Math.round(value * 10) / 10;
      khqt = cpl > 0 ? Math.round(value / cpl) : 0;
      gdtd = Math.round(khqt * cr1);
      khd  = Math.round(gdtd * cr2);
      break;

    case 'khqt':
      khqt = Math.round(value);
      ns   = Math.round(khqt * cpl * 10) / 10;
      gdtd = Math.round(khqt * cr1);
      khd  = Math.round(gdtd * cr2);
      break;

    case 'gdtd':
      gdtd = Math.round(value);
      khqt = cr1 > 0 ? Math.round(gdtd / cr1) : 0;
      ns   = Math.round(khqt * cpl * 10) / 10;
      khd  = Math.round(gdtd * cr2);
      break;

    case 'khd':
      khd  = Math.round(value);
      gdtd = cr2 > 0 ? Math.round(khd / cr2) : 0;
      khqt = cr1 > 0 ? Math.round(gdtd / cr1) : 0;
      ns   = Math.round(khqt * cpl * 10) / 10;
      break;

    default:
      ns = 0; khqt = 0; gdtd = 0; khd = 0;
  }

  return { ns, khqt, gdtd, khd };
}

// ─── Metric name ↔ key mapping ─────────────────────────────────────────────

export function metricNameToKey(name: string): GoalSeekMetric | null {
  const map: Record<string, GoalSeekMetric> = {
    'Ngân sách': 'ns', 'KHQT': 'khqt', 'GDTD': 'gdtd', 'KHĐ': 'khd',
  };
  return map[name] ?? null;
}

export function metricKeyToName(key: GoalSeekMetric): string {
  const map: Record<GoalSeekMetric, string> = {
    ns: 'Ngân sách', khqt: 'KHQT', gdtd: 'GDTD', khd: 'KHĐ',
  };
  return map[key];
}
