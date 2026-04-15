// app/src/app/(dashboard)/reports/page.tsx
'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchAllActualEntries } from '@/lib/actual-data';
import { fetchEventsFromDB, type EventsByMonth } from '@/lib/events-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import PageHeader from '@/components/layout/PageHeader';
import { ReportTabBar, type ReportTabId } from '@/components/reports/ReportTabBar';
import { ReportFilters, type ReportFilterState } from '@/components/reports/ReportFilters';
import { BudgetSummaryTab } from '@/components/reports/tabs/BudgetSummaryTab';
import { PlanVsActualTab } from '@/components/reports/tabs/PlanVsActualTab';
import { ChannelEfficiencyTab } from '@/components/reports/tabs/ChannelEfficiencyTab';
import { EventsReportTab } from '@/components/reports/tabs/EventsReportTab';
import { mergePayloads, getMonthsForPeriod, type MonthlyPayloads } from '@/lib/report-data';

export default function ReportsPage() {
  const { brands } = useBrands();
  const { showrooms: showroomItems } = useShowrooms();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTabId>('plan-vs-actual');

  const [compareMode, setCompareMode] = useState<'none' | 'prev' | 'prev_year'>('none');

  // Shared filter state
  const [filters, setFilters] = useState<ReportFilterState>({
    year: 2026, viewMode: 'month', month: new Date().getMonth() + 1,
    brand: '', showroom: '', channel: '',
  });

  // Raw data
  const [plansByMonth, setPlansByMonth] = useState<MonthlyPayloads>({});
  const [actualsByMonth, setActualsByMonth] = useState<MonthlyPayloads>({});
  const [prevYearActualsByMonth, setPrevYearActualsByMonth] = useState<MonthlyPayloads>({});
  const [eventsByMonth, setEventsByMonth] = useState<EventsByMonth>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plans, actuals, events] = await Promise.all([
        fetchAllBudgetPlans(),
        fetchAllActualEntries(filters.year),
        fetchEventsFromDB(),
      ]);
      const pm: MonthlyPayloads = {};
      plans.forEach(p => { pm[p.month] = p.payload || {}; });
      const am: MonthlyPayloads = {};
      actuals.forEach(a => { am[a.month] = a.payload || {}; });
      setPlansByMonth(pm);
      setActualsByMonth(am);
      setEventsByMonth(events);
    } finally {
      setLoading(false);
    }
  }, [filters.year]);

  useEffect(() => { loadData().then(() => setMounted(true)); }, [loadData]);

  // Lazy fetch prev year actuals khi cần so sánh cùng kỳ năm trước
  useEffect(() => {
    if (compareMode !== 'prev_year') return;
    fetchAllActualEntries(filters.year - 1).then(actuals => {
      const am: MonthlyPayloads = {};
      actuals.forEach(a => { am[a.month] = a.payload || {}; });
      setPrevYearActualsByMonth(am);
    });
  }, [compareMode, filters.year]);

  // Showroom names for filter dropdown (from context, not parsed from payload)
  const showrooms = useMemo(() => showroomItems.map(s => s.name), [showroomItems]);

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
                showroomItems={showroomItems.map(s => ({ name: s.name, weight: s.weight }))}
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
                showroomItems={showroomItems.map(s => ({ name: s.name, weight: s.weight }))}
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
