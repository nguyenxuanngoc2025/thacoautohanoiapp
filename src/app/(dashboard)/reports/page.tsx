// app/src/app/(dashboard)/reports/page.tsx
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  useViewBudgetByBrand, useViewBudgetByChannel, useViewBudgetMaster,
} from '@/lib/use-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { useChannels } from '@/contexts/ChannelsContext';
import PageHeader from '@/components/layout/PageHeader';
import { FilterDropdown } from '@/components/erp/FilterDropdown';
import { ReportTabBar, type ReportTabId } from '@/components/reports/ReportTabBar';
import { BudgetSummaryTab } from '@/components/reports/tabs/BudgetSummaryTab';
import { PlanVsActualTab } from '@/components/reports/tabs/PlanVsActualTab';
import { getMonthsForPeriod, mergePayloads, type MonthlyPayloads } from '@/lib/report-data';
import type { ViewBudgetByBrand, ViewBudgetByChannel, ViewBudgetMaster } from '@/types/database';

// ── Convert view rows → MonthlyPayloads ──────────────────────────────────────
//
// Sentinel prefix used for channel rows so brand lookups don't clash:
//   channel row key: "__ch__-{channel_code}-{metric}"   → sumByChannelMetric picks parts[-2]
//   brand row key:   "{brand_name}-__all__-{metric}"    → sumByBrandMetric picks parts[0]

const METRIC_SUFFIXES = ['ns', 'khqt', 'gdtd', 'khd'] as const;
const METRIC_NAMES: Record<string, string> = { ns: 'Ngân sách', khqt: 'KHQT', gdtd: 'GDTD', khd: 'KHĐ' };

function buildChannelPayloads(
  rows: ViewBudgetByChannel[] | undefined,
  type: 'plan' | 'actual',
  codeToName: Map<string, string>,
): MonthlyPayloads {
  if (!rows) return {};
  const pm: MonthlyPayloads = {};
  const prefix = type === 'plan' ? 'plan_' : 'actual_';
  for (const row of rows) {
    const chName = codeToName.get(row.channel_code) ?? row.channel_code;
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetByChannel;
      const key = `__ch__-${chName}-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

function buildBrandPayloads(
  rows: ViewBudgetByBrand[] | undefined,
  type: 'plan' | 'actual',
): MonthlyPayloads {
  if (!rows) return {};
  const pm: MonthlyPayloads = {};
  const prefix = type === 'plan' ? 'plan_' : 'actual_';
  for (const row of rows) {
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetByBrand;
      const key = `${row.brand_name}-__all__-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

// Build channel payloads from v_budget_master (used when any filter is active)
function buildChannelPayloadsFromMaster(
  rows: ViewBudgetMaster[],
  type: 'plan' | 'actual',
  codeToName: Map<string, string>,
): MonthlyPayloads {
  const pm: MonthlyPayloads = {};
  const prefix = type === 'plan' ? 'plan_' : 'actual_';
  for (const row of rows) {
    const chName = codeToName.get(row.channel_code) ?? row.channel_code;
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetMaster;
      const key = `__ch__-${chName}-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

// Build brand payloads from v_budget_master (used when any filter is active)
function buildBrandPayloadsFromMaster(
  rows: ViewBudgetMaster[],
  type: 'plan' | 'actual',
): MonthlyPayloads {
  const pm: MonthlyPayloads = {};
  const prefix = type === 'plan' ? 'plan_' : 'actual_';
  for (const row of rows) {
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetMaster;
      const key = `${row.brand_name}-__all__-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

// Build model payloads from v_budget_master — key: {brand}-{model}-__total__-{metric}
// sumByModelMetric expects: parts.slice(0, -2).join('-') === brand-model
function buildModelPayloadsFromMaster(
  rows: ViewBudgetMaster[],
  type: 'plan' | 'actual',
): MonthlyPayloads {
  const pm: MonthlyPayloads = {};
  const prefix = type === 'plan' ? 'plan_' : 'actual_';
  for (const row of rows) {
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetMaster;
      const key = `${row.brand_name}-${row.model_name}-__total__-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

function mergeViewPayloads(
  channelPm: MonthlyPayloads,
  brandPm: MonthlyPayloads,
): MonthlyPayloads {
  const months = new Set([...Object.keys(channelPm), ...Object.keys(brandPm)].map(Number));
  const merged: MonthlyPayloads = {};
  for (const m of months) {
    merged[m] = { ...(channelPm[m] ?? {}), ...(brandPm[m] ?? {}) };
  }
  return merged;
}

export default function ReportsPage() {
  const { brands } = useBrands();
  const { showrooms: showroomItems } = useShowrooms();
  const { profile, effectiveRole, accessibleShowroomCodes } = useAuth();
  const { activeUnitId } = useUnit();
  const { channels } = useChannels();

  // Map channel_code ↔ display name
  const codeToName = useMemo(
    () => new Map<string, string>(channels.map(c => [c.code, c.name])),
    [channels],
  );
  const nameToCode = useMemo(
    () => new Map<string, string>(channels.filter(c => !c.isAggregate).map(c => [c.name, c.code])),
    [channels],
  );

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabId>('plan-vs-actual');

  // ── Role-based Scope ──────────────────────────────────────────────────────
  const isRestrictedRole = ['mkt_showroom', 'gd_showroom'].includes(effectiveRole as string);
  // Multi-showroom: map codes → names (hỗ trợ cả profile.showroom_ids mới)
  const allowedShowroomNames = useMemo(() => {
    if (!isRestrictedRole || accessibleShowroomCodes.length === 0) return null;
    const names = showroomItems
      .filter(s => accessibleShowroomCodes.includes(s.code?.toUpperCase() ?? ''))
      .map(s => s.name);
    return names.length > 0 ? names : null;
  }, [isRestrictedRole, accessibleShowroomCodes, showroomItems]);
  const allowedShowroomName = allowedShowroomNames?.[0] ?? null;
  // mkt_brand: luôn lọc theo brands được giao (ngay cả khi chưa chọn filter)
  const brandRestriction: string[] = (effectiveRole === 'mkt_brand' && profile?.brands?.length)
    ? profile.brands
    : [];

  const [compareMode, setCompareMode] = useState<'none' | 'prev' | 'prev_year'>('none');

  // Shared filter state
  const [filters, setFilters] = useState({
    year: 2026,
    viewMode: 'month' as 'month' | 'quarter' | 'year',
    month: new Date().getMonth() + 1,
    brand: '',
    showroom: '',
    channel: '',
  });

  const updateFilters = (partial: Partial<typeof filters>) =>
    setFilters(prev => ({ ...prev, ...partial }));

  // ── Unit ID for views ─────────────────────────────────────────────────────
  const unitIdForViews = activeUnitId === 'all' ? null : activeUnitId;

  // ── SWR view-based data ───────────────────────────────────────────────────
  const { data: viewBrandRows }         = useViewBudgetByBrand(unitIdForViews, filters.year);
  const { data: viewChannelRows }       = useViewBudgetByChannel(unitIdForViews, filters.year);
  const { data: prevYearBrandRows }     = useViewBudgetByBrand(unitIdForViews, filters.year - 1);
  const { data: prevYearChannelRows }   = useViewBudgetByChannel(unitIdForViews, filters.year - 1);
  const { data: viewMasterRows }        = useViewBudgetMaster(unitIdForViews, filters.year);
  const { data: prevYearMasterRows }    = useViewBudgetMaster(unitIdForViews, filters.year - 1);

  // ── Filter resolution ─────────────────────────────────────────────────────
  const hasAnyFilter = !!(filters.brand || filters.showroom || filters.channel) || brandRestriction.length > 0;

  const filterShowroomId = useMemo(() => {
    if (!filters.showroom) return null;
    return showroomItems.find(s => s.name === filters.showroom)?.id ?? null;
  }, [filters.showroom, showroomItems]);

  const filterChannelCode = useMemo(() => {
    if (!filters.channel) return null;
    return nameToCode.get(filters.channel) ?? filters.channel;
  }, [filters.channel, nameToCode]);

  // ── Filtered master rows — áp dụng tất cả filters lên v_budget_master ─────
  const filteredMasterRows = useMemo<ViewBudgetMaster[] | null>(() => {
    if (!hasAnyFilter || !viewMasterRows) return null;
    return viewMasterRows.filter(r => {
      if (filterShowroomId && r.showroom_id !== filterShowroomId) return false;
      if (filters.brand && r.brand_name !== filters.brand) return false;
      // mkt_brand: lọc theo brand restriction nếu chưa chọn brand cụ thể
      if (brandRestriction.length > 0 && !filters.brand && !brandRestriction.includes(r.brand_name)) return false;
      if (filterChannelCode && r.channel_code !== filterChannelCode) return false;
      return true;
    });
  }, [viewMasterRows, hasAnyFilter, filterShowroomId, filters.brand, filterChannelCode, brandRestriction]);

  const filteredPrevYearMasterRows = useMemo<ViewBudgetMaster[] | null>(() => {
    if (!hasAnyFilter || !prevYearMasterRows) return null;
    return prevYearMasterRows.filter(r => {
      if (filterShowroomId && r.showroom_id !== filterShowroomId) return false;
      if (filters.brand && r.brand_name !== filters.brand) return false;
      if (brandRestriction.length > 0 && !filters.brand && !brandRestriction.includes(r.brand_name)) return false;
      if (filterChannelCode && r.channel_code !== filterChannelCode) return false;
      return true;
    });
  }, [prevYearMasterRows, hasAnyFilter, filterShowroomId, filters.brand, filterChannelCode, brandRestriction]);

  // ── Build MonthlyPayloads — ưu tiên master rows (kèm model data) ─────────
  // QUAN TRỌNG: CHỈ dùng channel keys + model keys.
  // KHÔNG dùng buildBrandPayloadsFromMaster (tạo __all__ keys) cùng lúc với
  // buildModelPayloadsFromMaster (tạo __total__ keys) — vì sumByBrandMetric
  // match cả hai → brand totals bị nhân đôi.
  // Model __total__ keys đã đủ để sumByBrandMetric aggregate lên brand level.
  function buildFromMaster(rows: ViewBudgetMaster[], type: 'plan' | 'actual'): MonthlyPayloads {
    const ch    = buildChannelPayloadsFromMaster(rows, type, codeToName);
    const model = buildModelPayloadsFromMaster(rows, type);
    return mergeViewPayloads(ch, model);
  }

  const plansByMonth = useMemo<MonthlyPayloads>(() => {
    const rows = filteredMasterRows ?? viewMasterRows;
    if (rows) return buildFromMaster(rows, 'plan');
    return mergeViewPayloads(
      buildChannelPayloads(viewChannelRows, 'plan', codeToName),
      buildBrandPayloads(viewBrandRows, 'plan'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMasterRows, viewMasterRows, viewChannelRows, viewBrandRows, codeToName]);

  const actualsByMonth = useMemo<MonthlyPayloads>(() => {
    const rows = filteredMasterRows ?? viewMasterRows;
    if (rows) return buildFromMaster(rows, 'actual');
    return mergeViewPayloads(
      buildChannelPayloads(viewChannelRows, 'actual', codeToName),
      buildBrandPayloads(viewBrandRows, 'actual'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMasterRows, viewMasterRows, viewChannelRows, viewBrandRows, codeToName]);

  const prevYearActualsByMonth = useMemo<MonthlyPayloads>(() => {
    if (compareMode !== 'prev_year') return {};
    const rows = filteredPrevYearMasterRows ?? prevYearMasterRows;
    if (rows) return buildFromMaster(rows, 'actual');
    return mergeViewPayloads(
      buildChannelPayloads(prevYearChannelRows, 'actual', codeToName),
      buildBrandPayloads(prevYearBrandRows, 'actual'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPrevYearMasterRows, prevYearMasterRows, prevYearChannelRows, prevYearBrandRows, compareMode, codeToName]);

  // When unitIdForViews is null (super_admin "all" mode), views are skipped — treat as ready
  const viewsReady = unitIdForViews === null
    ? true
    : viewMasterRows !== undefined;
  const loading = !viewsReady;

  useEffect(() => {
    if (!loading) setMounted(true);
  }, [loading]);

  // Showroom list for dropdowns (role-filtered)
  const showrooms = useMemo(() => {
    let items = showroomItems;
    if (isRestrictedRole && allowedShowroomNames) {
      items = items.filter(s => allowedShowroomNames.includes(s.name));
    } else if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      items = items.filter(s => s.brands.some(b => profile.brands!.includes(b)));
    }
    return items.map(s => s.name);
  }, [showroomItems, isRestrictedRole, allowedShowroomNames, effectiveRole, profile]);

  // brands passed to tabs — filtered by role restriction + user brand filter + showroom filter
  const tableBrands = useMemo(() => {
    let items = brandRestriction.length > 0
      ? brands.filter(b => brandRestriction.includes(b.name))
      : brands;
    if (filters.brand) items = items.filter(b => b.name === filters.brand);
    // Khi filter theo showroom, chỉ show brands thuộc showroom đó
    const activeShowroom = filters.showroom || (allowedShowroomNames?.length === 1 ? allowedShowroomNames[0] : null);
    if (activeShowroom) {
      const sr = showroomItems.find(s => s.name === activeShowroom);
      if (sr?.brands?.length) items = items.filter(b => sr.brands.includes(b.name));
    }
    return items;
  }, [brands, brandRestriction, filters.brand, filters.showroom, allowedShowroomNames, showroomItems]);

  // showroomItems passed to tabs — filtered by both role + user filter
  const tableShowroomItems = useMemo(() => {
    let items = showroomItems;
    if (isRestrictedRole && allowedShowroomNames) {
      items = items.filter(s => allowedShowroomNames.includes(s.name));
    } else if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      items = items.filter(s => s.brands.some(b => profile.brands!.includes(b)));
    }
    if (filters.showroom) {
      items = items.filter(s => s.name === filters.showroom);
    }
    return items.map(s => ({ name: s.name, weight: s.weight }));
  }, [showroomItems, isRestrictedRole, allowedShowroomNames, effectiveRole, profile, filters.showroom]);

  // ── Per-showroom MonthlyPayloads (real data from v_budget_master) ────────────
  const reportMonths = useMemo(
    () => getMonthsForPeriod(filters.viewMode, filters.month),
    [filters.viewMode, filters.month],
  );

  const showroomPayloadsByMonth = useMemo<Record<string, { plan: MonthlyPayloads; actual: MonthlyPayloads }>>(() => {
    if (!viewMasterRows) return {};
    const result: Record<string, { plan: MonthlyPayloads; actual: MonthlyPayloads }> = {};
    for (const sr of showroomItems) {
      const srRows = viewMasterRows.filter(r => r.showroom_id === sr.id);
      result[sr.name] = {
        plan:   buildChannelPayloadsFromMaster(srRows, 'plan',   codeToName),
        actual: buildChannelPayloadsFromMaster(srRows, 'actual', codeToName),
      };
    }
    return result;
  }, [viewMasterRows, showroomItems, codeToName]);

  // Pre-merge per-showroom data for current period (passed to PlanVsActualTab)
  const showroomMergedData = useMemo<Record<string, { plan: Record<string, number>; actual: Record<string, number> }>>(() => {
    const result: Record<string, { plan: Record<string, number>; actual: Record<string, number> }> = {};
    for (const [name, payloads] of Object.entries(showroomPayloadsByMonth)) {
      result[name] = {
        plan:   mergePayloads(payloads.plan,   reportMonths),
        actual: mergePayloads(payloads.actual, reportMonths),
      };
    }
    return result;
  }, [showroomPayloadsByMonth, reportMonths]);

  const { cmpPlansByMonth, cmpActualsByMonth, cmpMonths } = useMemo(() => {
    if (compareMode === 'none') {
      return { cmpPlansByMonth: {} as MonthlyPayloads, cmpActualsByMonth: {} as MonthlyPayloads, cmpMonths: [] as number[] };
    }
    if (compareMode === 'prev') {
      const prevM  = filters.month === 1 ? 12 : filters.month - 1;
      const months = getMonthsForPeriod(filters.viewMode, prevM);
      return { cmpPlansByMonth: plansByMonth, cmpActualsByMonth: actualsByMonth, cmpMonths: months };
    }
    // prev_year: same month(s) but from prev year data
    const months = getMonthsForPeriod(filters.viewMode, filters.month);
    return { cmpPlansByMonth: plansByMonth, cmpActualsByMonth: prevYearActualsByMonth, cmpMonths: months };
  }, [compareMode, filters, plansByMonth, actualsByMonth, prevYearActualsByMonth]);

  const compareLabel = useMemo(() => {
    if (compareMode === 'none') return '';
    if (compareMode === 'prev') {
      const prevM = filters.month === 1 ? 12 : filters.month - 1;
      const prevY = filters.month === 1 ? filters.year - 1 : filters.year;
      if (filters.viewMode === 'month')   return `T${prevM}/${prevY}`;
      if (filters.viewMode === 'quarter') {
        const prevM = filters.month === 1 ? 12 : filters.month - 1;
        const prevY = filters.month <= 3 ? filters.year - 1 : filters.year;
        return `Q${Math.ceil(prevM / 3)}/${prevY}`;
      }
      return `${filters.year - 1}`;
    }
    // prev_year
    if (filters.viewMode === 'month')   return `T${filters.month}/${filters.year - 1}`;
    if (filters.viewMode === 'quarter') return `Q${Math.ceil(filters.month / 3)}/${filters.year - 1}`;
    return `${filters.year - 1}`;
  }, [compareMode, filters]);

  const brandNames = useMemo(() => {
    let result = brandRestriction.length > 0
      ? brands.filter(b => brandRestriction.includes(b.name))
      : brands;
    // Khi filter theo showroom, chỉ show brands thuộc showroom đó
    const activeShowroom = filters.showroom || (allowedShowroomNames?.length === 1 ? allowedShowroomNames[0] : null);
    if (activeShowroom) {
      const sr = showroomItems.find(s => s.name === activeShowroom);
      if (sr?.brands?.length) result = result.filter(b => sr.brands.includes(b.name));
    }
    return result.map(b => b.name);
  }, [brands, brandRestriction, filters.showroom, allowedShowroomNames, showroomItems]);

  const channelOptions = useMemo(
    () => channels.filter(c => !c.isAggregate).map(c => ({ value: c.name, label: c.name })),
    [channels],
  );

  // Tab-specific filter visibility
  const showBrandFilter    = ['budget-summary', 'plan-vs-actual'].includes(activeTab);
  const showShowroomFilter = activeTab === 'plan-vs-actual';
  const showChannelFilter  = activeTab === 'budget-summary';
  const showAnyFilter      = showBrandFilter || showShowroomFilter || showChannelFilter;

  if (!mounted) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)', gap: 10 }}>
      <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Đang tải báo cáo...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        year={filters.year}
        month={filters.month}
        viewMode={filters.viewMode}
        onPeriodChange={(y, m) => updateFilters({ year: y, month: m })}
        onViewModeChange={(mode) => updateFilters({ viewMode: mode })}
        filters={showAnyFilter ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {showBrandFilter && (
              <FilterDropdown
                value={filters.brand || 'all'}
                options={[{ value: 'all', label: 'Tất cả Thương hiệu' }, ...brandNames.map(b => ({ value: b, label: b }))]}
                onChange={(v: string) => updateFilters({ brand: v === 'all' ? '' : v })}
                placeholder="Tất cả Thương hiệu"
                width={150}
              />
            )}
            {showShowroomFilter && (
              <FilterDropdown
                value={filters.showroom || 'all'}
                options={[{ value: 'all', label: 'Tất cả Showroom' }, ...showrooms.map(s => ({ value: s, label: s }))]}
                onChange={(v: string) => updateFilters({ showroom: v === 'all' ? '' : v })}
                placeholder="Tất cả Showroom"
                width={150}
              />
            )}
            {showChannelFilter && (
              <FilterDropdown
                value={filters.channel || 'all'}
                options={[{ value: 'all', label: 'Tất cả Kênh' }, ...channelOptions]}
                onChange={(v: string) => updateFilters({ channel: v === 'all' ? '' : v })}
                placeholder="Tất cả Kênh"
                width={130}
              />
            )}
            {hasAnyFilter && (
              <button
                onClick={() => updateFilters({ brand: '', showroom: '', channel: '' })}
                style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
              >✕ Bỏ lọc</button>
            )}
          </div>
        ) : undefined}
      />

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Tab bar */}
        <ReportTabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            // Reset filters khi đổi tab vì mỗi tab có bộ lọc khác nhau
            updateFilters({ brand: '', showroom: '', channel: '' });
          }}
        />

        {/* Comparison toolbar — plan-vs-actual tab only */}
        {activeTab === 'plan-vs-actual' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
            borderBottom: '1px solid var(--color-border-light)', marginBottom: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>So sánh với:</span>
            {(['none', 'prev', 'prev_year'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setCompareMode(mode)}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${compareMode === mode ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: compareMode === mode ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                  color: compareMode === mode ? '#fff' : 'var(--color-text)',
                }}
              >
                {mode === 'none' ? 'Không' : mode === 'prev' ? 'Kỳ liền trước' : 'Cùng kỳ năm trước'}
              </button>
            ))}
            {compareMode !== 'none' && compareLabel && (
              <span style={{ fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 4 }}>
                So với: {compareLabel}
              </span>
            )}
          </div>
        )}

        {/* Tab content */}
        {!loading && (
          <>
            {activeTab === 'budget-summary' && (
              <BudgetSummaryTab
                plansByMonth={plansByMonth}
                actualsByMonth={actualsByMonth}
                brands={tableBrands}
                showroomItems={tableShowroomItems}
                showroomPayloadsByMonth={showroomPayloadsByMonth}
              />
            )}
            {activeTab === 'plan-vs-actual' && (
              <PlanVsActualTab
                plansByMonth={plansByMonth}
                actualsByMonth={actualsByMonth}
                viewMode={filters.viewMode}
                month={filters.month}
                cmpPlansByMonth={cmpPlansByMonth}
                cmpActualsByMonth={cmpActualsByMonth}
                cmpMonths={cmpMonths}
                compareLabel={compareLabel}
                showroomItems={tableShowroomItems}
                brands={tableBrands}
                showroomMergedData={showroomMergedData}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
