/**
 * useFilteredBudget — Chuẩn hóa filter algorithm cho toàn bộ dashboard
 *
 * Kiến trúc:
 *   v_budget_master (showroom + brand + channel + year + month)
 *   → filteredRows (áp dụng tất cả filters)
 *   → aggregated breakdowns (byShowroom, byBrand, byChannel, byMonth, totals)
 *
 * Cách dùng:
 *   const { showroomBreakdown, brandBreakdown, channelBreakdown, barChartData, totals, planKpis } =
 *     useFilteredBudget({ unitId, year, monthsInView, filterShowroom, filterBrand, filterChannel });
 *
 * Các trang (Dashboard, Events, Reports) chỉ cần gọi hook này — không cần tự xử lý filter logic.
 */

import { useMemo } from 'react';
import { useViewBudgetByShowroom, useViewBudgetByBrand, useViewBudgetByChannel, useViewBudgetMaster } from './use-data';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useBrands } from '@/contexts/BrandsContext';
import { useChannels } from '@/contexts/ChannelsContext';
import type { ViewBudgetMaster } from '@/types/database';

// ── Màu cho donut chart kênh ──────────────────────────────────────────────────
const DONUT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

// ── Channels trong nhóm "Tổng Digital" ───────────────────────────────────────
const DIGITAL_CHANNEL_NAMES = ['Google', 'Facebook', 'Khác'];

export interface ShowroomBreakdownRow {
  name: string;
  plan: number;
  actual: number;
  khqt: number;
  gdtd: number;
  khd: number;
}

export interface BrandBreakdownRow {
  name: string;
  plan: number;
  actual: number;
  khqt: number;
  gdtd: number;
  khd: number;
}

export interface ChannelBreakdownRow {
  name: string;
  code: string;
  amount: number;
  pct: number;
  color: string;
}

export interface BarChartRow {
  name: string;   // "T1" → "T12"
  month: number;
  plan: number;
  actual: number;
  isActive: boolean;
}

export interface BudgetTotals {
  totalPlan: number;
  totalActual: number;
  totalKhqt: number;
  totalGdtd: number;
  totalKhd: number;
  cpl: number;
  budgetPct: number;
}

export interface PlanKpis {
  pBudget: number;
  pKhqt: number;
  pGdtd: number;
  pKhd: number;
}

export interface SparkData {
  budget: number[];
  khqt: number[];
  gdtd: number[];
  khd: number[];
}

export interface FilteredBudgetResult {
  showroomBreakdown: ShowroomBreakdownRow[];
  brandBreakdown: BrandBreakdownRow[];
  channelBreakdown: ChannelBreakdownRow[];
  barChartData: BarChartRow[];
  totals: BudgetTotals;
  planKpis: PlanKpis;
  sparkData: SparkData;
  /** Raw filtered rows — dùng cho custom aggregation nếu cần */
  filteredRows: ViewBudgetMaster[] | null;
  isLoading: boolean;
}

export interface UseFilteredBudgetParams {
  unitId: string | null;
  year: number;
  monthsInView: number[];
  activeMonth: number;   // month hiện tại để đánh dấu isActive trong barChart
  filterShowroom?: string[];  // tên showroom
  filterBrand?: string[];     // tên brand
  filterChannel?: string | null; // tên kênh hoặc "Tổng Digital"
}

// ── Helper: lấy channel codes khớp với filterChannel ─────────────────────────
function resolveChannelCodes(
  filterChannel: string | null,
  channelsData: { code: string; name: string; isAggregate?: boolean }[]
): string[] | null {
  if (!filterChannel) return null;
  const nameToCode = new Map(channelsData.filter(c => !c.isAggregate).map(c => [c.name, c.code]));
  if (filterChannel === 'Tổng Digital') {
    return DIGITAL_CHANNEL_NAMES.map(n => nameToCode.get(n)).filter(Boolean) as string[];
  }
  const code = nameToCode.get(filterChannel);
  return code ? [code] : [filterChannel]; // fallback: dùng tên như code
}

// ── Helper: aggregate master rows theo showroom ───────────────────────────────
function aggregateByShowroom(
  rows: ViewBudgetMaster[],
  showroomList: { id: string; name: string }[],
  monthsInView: number[]
): ShowroomBreakdownRow[] {
  return showroomList.map(sr => {
    let plan = 0, actual = 0, khqt = 0, gdtd = 0, khd = 0;
    for (const r of rows) {
      if (r.showroom_id !== sr.id || !monthsInView.includes(r.month)) continue;
      plan   += r.plan_ns      ?? 0;
      actual += r.actual_ns    ?? 0;
      khqt   += r.actual_khqt  ?? 0;
      gdtd   += r.actual_gdtd  ?? 0;
      khd    += r.actual_khd   ?? 0;
    }
    return { name: sr.name, plan, actual, khqt, gdtd, khd };
  });
}

// ── Helper: aggregate master rows theo brand ──────────────────────────────────
function aggregateByBrand(
  rows: ViewBudgetMaster[],
  brandList: { name: string }[],
  monthsInView: number[]
): BrandBreakdownRow[] {
  return brandList.map(br => {
    let plan = 0, actual = 0, khqt = 0, gdtd = 0, khd = 0;
    for (const r of rows) {
      if (r.brand_name !== br.name || !monthsInView.includes(r.month)) continue;
      plan   += r.plan_ns      ?? 0;
      actual += r.actual_ns    ?? 0;
      khqt   += r.actual_khqt  ?? 0;
      gdtd   += r.actual_gdtd  ?? 0;
      khd    += r.actual_khd   ?? 0;
    }
    return { name: br.name, plan, actual, khqt, gdtd, khd };
  });
}

// ── Helper: aggregate master rows theo channel ────────────────────────────────
function aggregateByChannel(
  rows: ViewBudgetMaster[],
  codeToName: Map<string, string>,
  monthsInView: number[]
): ChannelBreakdownRow[] {
  const byCode = new Map<string, { actual: number; plan: number }>();
  for (const r of rows) {
    if (!monthsInView.includes(r.month)) continue;
    const entry = byCode.get(r.channel_code) ?? { actual: 0, plan: 0 };
    entry.actual += r.actual_ns ?? 0;
    entry.plan   += r.plan_ns   ?? 0;
    byCode.set(r.channel_code, entry);
  }
  const list = Array.from(byCode.entries()).map(([code, { actual, plan }]) => ({
    name: codeToName.get(code) ?? code,
    code,
    amount: actual > 0 ? actual : plan,
  }));
  const total = list.reduce((s, c) => s + c.amount, 0);
  return list
    .map((ch, i) => ({
      ...ch,
      pct: total > 0 ? Math.round((ch.amount / total) * 100) : 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ── Helper: aggregate theo tháng (12-month bar chart) ────────────────────────
function aggregateByMonth(
  rows: ViewBudgetMaster[],
  activeMonth: number
): BarChartRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    let plan = 0, actual = 0;
    for (const r of rows) {
      if (r.month !== m) continue;
      plan   += r.plan_ns   ?? 0;
      actual += r.actual_ns ?? 0;
    }
    return { name: `T${m}`, month: m, plan: Math.round(plan), actual: Math.round(actual), isActive: m === activeMonth };
  });
}

// ── Helper: totals ────────────────────────────────────────────────────────────
function computeTotals(breakdown: ShowroomBreakdownRow[]): BudgetTotals {
  const tp  = breakdown.reduce((s, r) => s + r.plan, 0);
  const ta  = breakdown.reduce((s, r) => s + r.actual, 0);
  const tkq = breakdown.reduce((s, r) => s + r.khqt, 0);
  const tgd = breakdown.reduce((s, r) => s + r.gdtd, 0);
  const tkd = breakdown.reduce((s, r) => s + r.khd, 0);
  return {
    totalPlan: tp, totalActual: ta, totalKhqt: tkq, totalGdtd: tgd, totalKhd: tkd,
    cpl: tkq > 0 ? ta / tkq : 0,
    budgetPct: tp > 0 ? ta / tp * 100 : 0,
  };
}

function computePlanKpis(
  rows: ViewBudgetMaster[] | { plan_ns: number; plan_khqt: number; plan_gdtd: number; plan_khd: number }[],
  monthsInView: number[]
): PlanKpis {
  let ns = 0, khqt = 0, gdtd = 0, khd = 0;
  for (const r of rows) {
    if ('month' in r && !monthsInView.includes((r as ViewBudgetMaster).month)) continue;
    ns   += r.plan_ns   ?? 0;
    khqt += r.plan_khqt ?? 0;
    gdtd += r.plan_gdtd ?? 0;
    khd  += r.plan_khd  ?? 0;
  }
  return { pBudget: ns, pKhqt: khqt, pGdtd: gdtd, pKhd: khd };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════
export function useFilteredBudget({
  unitId,
  year,
  monthsInView,
  activeMonth,
  filterShowroom = [],
  filterBrand = [],
  filterChannel = null,
}: UseFilteredBudgetParams): FilteredBudgetResult {
  const { showrooms } = useShowrooms();
  const { brands } = useBrands();
  const { channels: channelsData } = useChannels();

  // ── Fetch views ────────────────────────────────────────────────────────────
  const { data: viewByShowroom } = useViewBudgetByShowroom(unitId, year);
  const { data: viewByBrand }    = useViewBudgetByBrand(unitId, year);
  const { data: viewByChannel }  = useViewBudgetByChannel(unitId, year);
  const { data: viewMaster }     = useViewBudgetMaster(unitId, year);

  const isLoading = viewByShowroom === undefined || viewMaster === undefined;

  // ── filterShowroomCodes ────────────────────────────────────────────────────
  const filterShowroomCodes = useMemo(() => {
    if (filterShowroom.length === 0) return null;
    return filterShowroom
      .map(name => showrooms.find(s => s.name === name)?.code)
      .filter(Boolean) as string[];
  }, [filterShowroom, showrooms]);

  const filterShowroomIds = useMemo(() => {
    if (filterShowroom.length === 0) return null;
    return showrooms
      .filter(s => filterShowroom.includes(s.name))
      .map(s => s.id);
  }, [filterShowroom, showrooms]);

  // ── Có filter nào không? ───────────────────────────────────────────────────
  const hasAnyFilter = filterShowroom.length > 0 || filterBrand.length > 0 || filterChannel !== null;

  // ── allowedChannelCodes ────────────────────────────────────────────────────
  const allowedChannelCodes = useMemo(
    () => resolveChannelCodes(filterChannel, channelsData),
    [filterChannel, channelsData]
  );

  // ── filteredRows: áp dụng tất cả filters lên v_budget_master ──────────────
  const filteredRows = useMemo<ViewBudgetMaster[] | null>(() => {
    if (!hasAnyFilter || !viewMaster) return null;
    return viewMaster.filter(r => {
      if (filterShowroomIds && !filterShowroomIds.includes(r.showroom_id)) return false;
      if (filterBrand.length > 0 && !filterBrand.includes(r.brand_name)) return false;
      if (allowedChannelCodes && !allowedChannelCodes.includes(r.channel_code)) return false;
      return true;
    });
  }, [viewMaster, hasAnyFilter, filterShowroomIds, filterBrand, allowedChannelCodes]);

  // ── codeToName map cho channel ─────────────────────────────────────────────
  const codeToName = useMemo(
    () => new Map<string, string>(channelsData.filter(c => !c.isAggregate).map(c => [c.code, c.name])),
    [channelsData]
  );

  // ── showroomBreakdown ──────────────────────────────────────────────────────
  const showroomBreakdown = useMemo<ShowroomBreakdownRow[]>(() => {
    const srList = filterShowroom.length === 0
      ? showrooms
      : showrooms.filter(s => filterShowroom.includes(s.name));

    if (filteredRows) return aggregateByShowroom(filteredRows, srList, monthsInView);

    // Fallback: v_budget_by_showroom (không có filter)
    return srList.map(sr => {
      let plan = 0, actual = 0, khqt = 0, gdtd = 0, khd = 0;
      for (const r of (viewByShowroom ?? [])) {
        if (r.showroom_id !== sr.id || !monthsInView.includes(r.month)) continue;
        plan   += r.plan_ns      ?? 0;
        actual += r.actual_ns    ?? 0;
        khqt   += r.actual_khqt  ?? 0;
        gdtd   += r.actual_gdtd  ?? 0;
        khd    += r.actual_khd   ?? 0;
      }
      return { name: sr.name, plan, actual, khqt, gdtd, khd };
    });
  }, [filteredRows, viewByShowroom, showrooms, filterShowroom, monthsInView]);

  // ── brandBreakdown ─────────────────────────────────────────────────────────
  const brandBreakdown = useMemo<BrandBreakdownRow[]>(() => {
    let brList = filterBrand.length === 0
      ? brands
      : brands.filter(b => filterBrand.includes(b.name));

    if (filteredRows) {
      // Khi filter theo showroom, chỉ hiển thị brands được config cho showroom đó
      if (filterShowroom.length > 0) {
        const showroomBrands = new Set(
          showrooms
            .filter(s => filterShowroom.includes(s.name))
            .flatMap(s => s.brands ?? [])
        );
        if (showroomBrands.size > 0) {
          brList = brList.filter(b => showroomBrands.has(b.name));
        }
      }
      return aggregateByBrand(filteredRows, brList, monthsInView);
    }

    // Fallback: v_budget_by_brand
    return brList.map(br => {
      let plan = 0, actual = 0, khqt = 0, gdtd = 0, khd = 0;
      for (const r of (viewByBrand ?? [])) {
        if (r.brand_name !== br.name || !monthsInView.includes(r.month)) continue;
        plan   += r.plan_ns      ?? 0;
        actual += r.actual_ns    ?? 0;
        khqt   += r.actual_khqt  ?? 0;
        gdtd   += r.actual_gdtd  ?? 0;
        khd    += r.actual_khd   ?? 0;
      }
      return { name: br.name, plan, actual, khqt, gdtd, khd };
    });
  }, [filteredRows, viewByBrand, brands, filterBrand, filterShowroom, monthsInView]);

  // ── channelBreakdown ───────────────────────────────────────────────────────
  const channelBreakdown = useMemo<ChannelBreakdownRow[]>(() => {
    const sourceRows = filteredRows ?? viewMaster ?? [];
    if (sourceRows.length === 0) {
      return (viewByChannel
        ? Array.from(new Set(viewByChannel.filter(r => monthsInView.includes(r.month)).map(r => r.channel_code)))
            .map((code, i) => {
              const rows = viewByChannel.filter(r => r.channel_code === code && monthsInView.includes(r.month));
              const actual = rows.reduce((s, r) => s + (r.actual_ns ?? 0), 0);
              const plan   = rows.reduce((s, r) => s + (r.plan_ns   ?? 0), 0);
              return { name: codeToName.get(code) ?? code, code, amount: actual > 0 ? actual : plan, pct: 0, color: DONUT_COLORS[i % DONUT_COLORS.length] };
            })
        : []);
    }
    return aggregateByChannel(sourceRows as ViewBudgetMaster[], codeToName, monthsInView);
  }, [filteredRows, viewMaster, viewByChannel, codeToName, monthsInView]);

  // ── barChartData (12 months) ───────────────────────────────────────────────
  const barChartData = useMemo<BarChartRow[]>(() => {
    const sourceRows = filteredRows ?? viewMaster ?? [];
    return aggregateByMonth(sourceRows as ViewBudgetMaster[], activeMonth);
  }, [filteredRows, viewMaster, activeMonth]);

  // ── totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => computeTotals(showroomBreakdown), [showroomBreakdown]);

  // ── planKpis ───────────────────────────────────────────────────────────────
  const planKpis = useMemo<PlanKpis>(() => {
    const sourceRows = filteredRows ?? (viewMaster ?? []);
    return computePlanKpis(sourceRows, monthsInView);
  }, [filteredRows, viewMaster, monthsInView]);

  // ── sparkData — 5-month trailing trend ────────────────────────────────────
  const sparkData = useMemo<SparkData>(() => {
    const sourceRows = filteredRows ?? viewMaster ?? [];
    const last5 = Array.from({ length: 5 }, (_, i) => {
      const m = activeMonth - 4 + i;
      return m < 1 ? m + 12 : m;
    });
    const sum = (m: number, field: keyof Pick<ViewBudgetMaster, 'actual_ns'|'actual_khqt'|'actual_gdtd'|'actual_khd'>) =>
      (sourceRows as ViewBudgetMaster[]).filter(r => r.month === m).reduce((s, r) => s + (r[field] ?? 0), 0);
    return {
      budget: last5.map(m => sum(m, 'actual_ns')),
      khqt:   last5.map(m => sum(m, 'actual_khqt')),
      gdtd:   last5.map(m => sum(m, 'actual_gdtd')),
      khd:    last5.map(m => sum(m, 'actual_khd')),
    };
  }, [filteredRows, viewMaster, activeMonth]);

  return {
    showroomBreakdown,
    brandBreakdown,
    channelBreakdown,
    barChartData,
    totals,
    planKpis,
    sparkData,
    filteredRows,
    isLoading,
  };
}
