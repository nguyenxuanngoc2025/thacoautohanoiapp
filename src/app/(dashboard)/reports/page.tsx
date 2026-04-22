// app/src/app/(dashboard)/reports/page.tsx
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { type EventsByMonth } from '@/lib/events-data';
import { useEventsData, useViewBudgetByBrand, useViewBudgetByChannel } from '@/lib/use-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { useChannels } from '@/contexts/ChannelsContext';
import PageHeader from '@/components/layout/PageHeader';
import { ReportTabBar, type ReportTabId } from '@/components/reports/ReportTabBar';
import { ReportFilters, type ReportFilterState } from '@/components/reports/ReportFilters';
import { BudgetSummaryTab } from '@/components/reports/tabs/BudgetSummaryTab';
import { PlanVsActualTab } from '@/components/reports/tabs/PlanVsActualTab';
import { ChannelEfficiencyTab } from '@/components/reports/tabs/ChannelEfficiencyTab';
import { EventsReportTab } from '@/components/reports/tabs/EventsReportTab';
import { getMonthsForPeriod, type MonthlyPayloads } from '@/lib/report-data';
import type { ViewBudgetByBrand, ViewBudgetByChannel } from '@/types/database';

// ── Convert view rows → MonthlyPayloads ──────────────────────────────────────
//
// Sentinel prefix used for channel rows so brand lookups don't clash:
//   channel row key: "__ch__-{channel_code}-{metric}"   → sumByChannelMetric picks parts[-2]
//   brand row key:   "{brand_name}-__all__-{metric}"    → sumByBrandMetric picks parts[0]
//
// The two key spaces don't overlap:
//   sumByChannelMetric checks parts[-2] — won't match "__all__" brand rows
//   sumByBrandMetric  checks parts[0]  — won't match "__ch__" channel rows
// totalAllChannels (used by ChannelEfficiencyTab/BudgetSummaryTab) sums REPORT_CHANNELS
//   using sumByChannelMetric so it only counts channel rows.

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
    // Resolve channel_code → display name (fallback to code if not found)
    const chName = codeToName.get(row.channel_code) ?? row.channel_code;
    if (!pm[row.month]) pm[row.month] = {};
    const payload = pm[row.month];
    for (const sfx of METRIC_SUFFIXES) {
      const field = `${prefix}${sfx}` as keyof ViewBudgetByChannel;
      // Key format: "__ch__-{channelName}-{metric}" — sentinel prefix avoids brand collisions
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
      // Key format: "{brandName}-__all__-{metric}" — avoids channel collisions
      const key = `${row.brand_name}-__all__-${METRIC_NAMES[sfx]}`;
      payload[key] = (payload[key] ?? 0) + (row[field] as number);
    }
  }
  return pm;
}

/** Merge channel + brand payloads into a single MonthlyPayloads map. */
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
  const { profile, effectiveRole } = useAuth();
  const { activeUnitId } = useUnit();
  const { channels } = useChannels();

  // Map channel_code → display name (e.g. 'facebook' → 'Facebook')
  const codeToName = useMemo(
    () => new Map<string, string>(channels.map(c => [c.code, c.name])),
    [channels],
  );

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabId>('plan-vs-actual');

  // ── Role-based Scope ──────────────────────────────────────────────────────────────────
  const isRestrictedRole = ['mkt_showroom', 'gd_showroom'].includes(effectiveRole as string);
  const allowedShowroomName = isRestrictedRole ? profile?.showroom?.name : null;

  const [compareMode, setCompareMode] = useState<'none' | 'prev' | 'prev_year'>('none');

  // Shared filter state
  const [filters, setFilters] = useState<ReportFilterState>({
    year: 2026, viewMode: 'month', month: new Date().getMonth() + 1,
    brand: '', showroom: '', channel: '',
  });

  // ── Unit ID for views ─────────────────────────────────────────────────────────────────
  const unitIdForViews = activeUnitId === 'all' ? null : activeUnitId;

  // ── SWR view-based data ──────────────────────────────────────────────────────────────
  const { data: viewBrandRows }   = useViewBudgetByBrand(unitIdForViews, filters.year);
  const { data: viewChannelRows } = useViewBudgetByChannel(unitIdForViews, filters.year);
  const { data: prevYearBrandRows }   = useViewBudgetByBrand(unitIdForViews, filters.year - 1);
  const { data: prevYearChannelRows } = useViewBudgetByChannel(unitIdForViews, filters.year - 1);
  const { data: eventsRaw }           = useEventsData();

  // ── Build MonthlyPayloads from views ─────────────────────────────────────────────────
  const plansByMonth = useMemo<MonthlyPayloads>(
    () => mergeViewPayloads(
      buildChannelPayloads(viewChannelRows, 'plan', codeToName),
      buildBrandPayloads(viewBrandRows, 'plan'),
    ),
    [viewChannelRows, viewBrandRows, codeToName],
  );

  const actualsByMonth = useMemo<MonthlyPayloads>(
    () => mergeViewPayloads(
      buildChannelPayloads(viewChannelRows, 'actual', codeToName),
      buildBrandPayloads(viewBrandRows, 'actual'),
    ),
    [viewChannelRows, viewBrandRows, codeToName],
  );

  const prevYearActualsByMonth = useMemo<MonthlyPayloads>(() => {
    if (compareMode !== 'prev_year') return {};
    return mergeViewPayloads(
      buildChannelPayloads(prevYearChannelRows, 'actual', codeToName),
      buildBrandPayloads(prevYearBrandRows, 'actual'),
    );
  }, [prevYearChannelRows, prevYearBrandRows, compareMode, codeToName]);

  const eventsByMonth = useMemo<EventsByMonth>(() => eventsRaw ?? {}, [eventsRaw]);

  const loading = viewBrandRows === undefined || viewChannelRows === undefined || eventsRaw === undefined;

  useEffect(() => {
    if (!loading) setMounted(true);
  }, [loading]);

  // Showroom names for filter dropdown (from context, not parsed from payload)
  const showrooms = useMemo(() => {
    let items = showroomItems;
    if (isRestrictedRole && allowedShowroomName) {
      items = items.filter(s => s.name === allowedShowroomName);
    }
    return items.map(s => s.name);
  }, [showroomItems, isRestrictedRole, allowedShowroomName]);

  const tableShowroomItems = useMemo(() => {
    let items = showroomItems;
    if (isRestrictedRole && allowedShowroomName) {
      items = items.filter(s => s.name === allowedShowroomName);
    }
    return items.map(s => ({ name: s.name, weight: s.weight }));
  }, [showroomItems, isRestrictedRole, allowedShowroomName]);

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
      if (filters.viewMode === 'quarter') return `Q${Math.max(1, Math.ceil(filters.month / 3) - 1)}/${filters.year}`;
      return `${filters.year - 1}`;
    }
    // prev_year
    if (filters.viewMode === 'month')   return `T${filters.month}/${filters.year - 1}`;
    if (filters.viewMode === 'quarter') return `Q${Math.ceil(filters.month / 3)}/${filters.year - 1}`;
    return `${filters.year - 1}`;
  }, [compareMode, filters]);

  const brandNames = useMemo(() => brands.map(b => b.name), [brands]);

  const updateFilters = (partial: Partial<ReportFilterState>) =>
    setFilters(prev => ({ ...prev, ...partial }));

  if (!mounted) return null;

  // Tab-specific visible filter fields
  const filterFields: Record<ReportTabId, string[]> = {
    'budget-summary':     ['viewMode', 'period', 'brand', 'channel'],
    'plan-vs-actual':     ['viewMode', 'period', 'brand', 'showroom'],
    'channel-efficiency': ['viewMode', 'period'],
    'events':             ['period', 'showroom'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* PageHeader — period only */}
      <PageHeader
        year={filters.year}
        month={filters.month}
        viewMode={filters.viewMode}
        onPeriodChange={(y, m) => updateFilters({ year: y, month: m })}
        onViewModeChange={(mode) => updateFilters({ viewMode: mode })}
      />

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FileText size={18} color="var(--color-primary)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Báo cáo</span>
          {loading && (
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>Đang tải...</span>
          )}
        </div>

        {/* Tab bar */}
        <ReportTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Filter bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', borderBottom: '1px solid var(--color-border-light)', marginBottom: 16,
          flexWrap: 'wrap', gap: 8,
        }}>
          <ReportFilters
            filters={filters}
            showrooms={showrooms}
            brands={brandNames}
            onChange={updateFilters}
            visibleFields={filterFields[activeTab]}
          />
        </div>

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
                  background: compareMode === mode ? 'var(--color-primary)' : '#fff',
                  color: compareMode === mode ? '#fff' : 'var(--color-text)',
                }}
              >
                {mode === 'none' ? 'Không' : mode === 'prev' ? 'Kỳ liền trước' : 'Cùng kỳ năm trước'}
              </button>
            ))}
            {compareMode !== 'none' && compareLabel && (
              <span style={{ fontSize: 11, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 4 }}>
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
                brands={brands}
                showroomItems={tableShowroomItems}
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
                brands={brands}
              />
            )}
            {activeTab === 'channel-efficiency' && (
              <ChannelEfficiencyTab
                plansByMonth={plansByMonth}
                actualsByMonth={actualsByMonth}
                viewMode={filters.viewMode}
                month={filters.month}
              />
            )}
            {activeTab === 'events' && (
              <EventsReportTab
                eventsByMonth={eventsByMonth}
                filterMonth={filters.viewMode === 'month' ? filters.month : 0}
                filterShowroom={filters.showroom}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
