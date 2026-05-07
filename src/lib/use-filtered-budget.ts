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

// ── Helper: aggregate master rows theo showroom (data-driven) ─────────────────
// Dùng data làm nguồn, lookup tên từ context. Không bỏ sót entry nào.
function aggregateByShowroom(
  rows: ViewBudgetMaster[],
  showroomList: { id: string; name: string }[],
  monthsInView: number[]
): ShowroomBreakdownRow[] {
  const idToName = new Map(showroomList.map(s => [s.id, s.name]));
  const byId = new Map<string, ShowroomBreakdownRow>();
  for (const r of rows) {
    if (!monthsInView.includes(r.month)) continue;
    const name = idToName.get(r.showroom_id) ?? r.showroom_id;
    const entry = byId.get(r.showroom_id) ?? { name, plan: 0, actual: 0, khqt: 0, gdtd: 0, khd: 0 };
    entry.plan   += r.plan_ns      ?? 0;
    entry.actual += r.actual_ns    ?? 0;
    entry.khqt   += r.actual_khqt  ?? 0;
    entry.gdtd   += r.actual_gdtd  ?? 0;
    entry.khd    += r.actual_khd   ?? 0;
    byId.set(r.showroom_id, entry);
  }
  // Giữ thứ tự theo showroomList (context order), sau đó append orphan entries
  const result: ShowroomBreakdownRow[] = [];
  for (const sr of showroomList) {
    const e = byId.get(sr.id);
    if (e) result.push(e);
    byId.delete(sr.id);
  }
  // Orphan showrooms (có data nhưng không trong context)
  for (const e of byId.values()) result.push(e);
  return result;
}

// ── Helper: aggregate master rows theo brand (data-driven) ────────────────────
// Dùng data làm nguồn → tổng brand = tổng showroom = tổng KPI cards.
function aggregateByBrand(
  rows: ViewBudgetMaster[],
  brandList: { name: string }[],
  monthsInView: number[]
): BrandBreakdownRow[] {
  const knownBrands = new Set(brandList.map(b => b.name));
  const byName = new Map<string, BrandBreakdownRow>();
  for (const r of rows) {
    if (!monthsInView.includes(r.month)) continue;
    const name = r.brand_name || '(Không xác định)';
    const entry = byName.get(name) ?? { name, plan: 0, actual: 0, khqt: 0, gdtd: 0, khd: 0 };
    entry.plan   += r.plan_ns      ?? 0;
    entry.actual += r.actual_ns    ?? 0;
    entry.khqt   += r.actual_khqt  ?? 0;
    entry.gdtd   += r.actual_gdtd  ?? 0;
    entry.khd    += r.actual_khd   ?? 0;
    byName.set(name, entry);
  }
  // Giữ thứ tự theo brandList, sau đó append orphan brands
  const result: BrandBreakdownRow[] = [];
  for (const br of brandList) {
    const e = byName.get(br.name);
    if (e) result.push(e);
    byName.delete(br.name);
  }
  for (const e of byName.values()) {
    if (!knownBrands.has(e.name)) result.push(e); // orphan brands
  }
  return result;
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

// ── Helper: totals — tính thẳng từ raw rows (nguồn duy nhất, không qua breakdown) ──
function computeTotals(rows: ViewBudgetMaster[], monthsInView: number[]): BudgetTotals {
  let tp = 0, ta = 0, tkq = 0, tgd = 0, tkd = 0;
  for (const r of rows) {
    if (!monthsInView.includes(r.month)) continue;
    tp  += r.plan_ns      ?? 0;
    ta  += r.actual_ns    ?? 0;
    tkq += r.actual_khqt  ?? 0;
    tgd += r.actual_gdtd  ?? 0;
    tkd += r.actual_khd   ?? 0;
  }
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

  // ── Context sets — dùng để loại orphan entries trước khi aggregate ──────
  // Orphan entries = data cũ cho showroom/brand/channel/model đã bị xóa/đổi tên.
  // Dashboard phải dùng cùng scope với planning để số khớp nhau.
  const ctxShowroomIds = useMemo(() => new Set(showrooms.map(s => s.id)), [showrooms]);
  const ctxBrandNames  = useMemo(() => new Set(brands.map(b => b.name)), [brands]);
  const ctxChannelCodes = useMemo(
    () => new Set(channelsData.filter(c => !c.isAggregate).map(c => c.code)),
    [channelsData]
  );
  const aggregateModelNames = useMemo(() => {
    const s = new Set<string>();
    for (const b of brands) {
      for (const m of (b.modelData ?? [])) {
        if (m.is_aggregate) s.add(m.name);
      }
    }
    return s;
  }, [brands]);

  // Tập hợp các cặp (brand_name|model_name) hợp lệ theo context
  // Dùng để loại orphan model entries (model đã bị xóa/đổi tên)
  // Planning chỉ iterate brand.models hiện tại — dashboard phải dùng cùng scope.
  // Chỉ include non-aggregate models — aggregate models đã bị loại riêng ở bước trên
  const ctxBrandModelPairs = useMemo(() => {
    const s = new Set<string>();
    for (const b of brands) {
      for (const m of (b.modelData ?? [])) {
        if (!m.is_aggregate) s.add(`${b.name}|${m.name}`);
      }
    }
    return s;
  }, [brands]);

  // ── filteredRows: áp dụng context clean + user filters lên v_budget_master ─
  // Bước 1 (context clean): loại orphan showroom/brand/channel/aggregate model.
  // Bước 2 (user filter): áp dụng filterShowroom/Brand/Channel của user.
  // → Đảm bảo dashboard và planning dùng cùng data scope.
  const filteredRows = useMemo<ViewBudgetMaster[] | null>(() => {
    if (!viewMaster) return null;
    let base = viewMaster.filter(r => {
      if (!ctxShowroomIds.has(r.showroom_id)) return false;   // orphan showroom
      if (!ctxBrandNames.has(r.brand_name)) return false;      // orphan brand
      if (!ctxChannelCodes.has(r.channel_code)) return false;  // orphan channel
      if (aggregateModelNames.has(r.model_name)) return false; // aggregate model (double-count)
      // Orphan model: brand_name hợp lệ nhưng model_name không còn trong context
      // Planning chỉ iterate brand.models hiện tại → phải dùng cùng scope
      if (ctxBrandModelPairs.size > 0 && !ctxBrandModelPairs.has(`${r.brand_name}|${r.model_name}`)) return false;
      return true;
    });
    if (hasAnyFilter) {
      base = base.filter(r => {
        if (filterShowroomIds && !filterShowroomIds.includes(r.showroom_id)) return false;
        if (filterBrand.length > 0 && !filterBrand.includes(r.brand_name)) return false;
        if (allowedChannelCodes && !allowedChannelCodes.includes(r.channel_code)) return false;
        return true;
      });
    }
    return base;
  }, [viewMaster, ctxShowroomIds, ctxBrandNames, ctxChannelCodes, aggregateModelNames, ctxBrandModelPairs,
      hasAnyFilter, filterShowroomIds, filterBrand, allowedChannelCodes]);

  // ── codeToName map cho channel ─────────────────────────────────────────────
  const codeToName = useMemo(
    () => new Map<string, string>(channelsData.filter(c => !c.isAggregate).map(c => [c.code, c.name])),
    [channelsData]
  );

  // ── showroomBreakdown — luôn từ filteredRows (data-driven) ──────────────────
  const showroomBreakdown = useMemo<ShowroomBreakdownRow[]>(() => {
    if (!filteredRows) return [];
    const srList = filterShowroom.length === 0
      ? showrooms
      : showrooms.filter(s => filterShowroom.includes(s.name));
    return aggregateByShowroom(filteredRows, srList, monthsInView);
  }, [filteredRows, showrooms, filterShowroom, monthsInView]);

  // ── brandBreakdown — luôn từ filteredRows (data-driven) ──────────────────
  const brandBreakdown = useMemo<BrandBreakdownRow[]>(() => {
    if (!filteredRows) return [];
    const brList = filterBrand.length === 0 ? brands : brands.filter(b => filterBrand.includes(b.name));
    return aggregateByBrand(filteredRows, brList, monthsInView);
  }, [filteredRows, brands, filterBrand, monthsInView]);

  // ── channelBreakdown ───────────────────────────────────────────────────────
  const channelBreakdown = useMemo<ChannelBreakdownRow[]>(() => {
    return aggregateByChannel(filteredRows ?? [], codeToName, monthsInView);
  }, [filteredRows, codeToName, monthsInView]);

  // ── barChartData (12 months) ───────────────────────────────────────────────
  const barChartData = useMemo<BarChartRow[]>(() => {
    return aggregateByMonth(filteredRows ?? [], activeMonth);
  }, [filteredRows, activeMonth]);

  // ── totals — tính thẳng từ filteredRows, đảm bảo khớp mọi bảng ──────────
  const totals = useMemo(
    () => computeTotals(filteredRows ?? [], monthsInView),
    [filteredRows, monthsInView]
  );

  // ── planKpis ───────────────────────────────────────────────────────────────
  const planKpis = useMemo<PlanKpis>(
    () => computePlanKpis(filteredRows ?? [], monthsInView),
    [filteredRows, monthsInView]
  );

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
