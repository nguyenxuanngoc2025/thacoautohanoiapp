// app/src/app/(dashboard)/reports/page.tsx
'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchAllActualEntries } from '@/lib/actual-data';
import { fetchEventsFromDB, type EventsByMonth } from '@/lib/events-data';
import { useBrands } from '@/contexts/BrandsContext';
import PageHeader from '@/components/layout/PageHeader';
import { ReportTabBar, type ReportTabId } from '@/components/reports/ReportTabBar';
import { ReportFilters, type ReportFilterState } from '@/components/reports/ReportFilters';
import { BudgetSummaryTab } from '@/components/reports/tabs/BudgetSummaryTab';
import { PlanVsActualTab } from '@/components/reports/tabs/PlanVsActualTab';
import { ChannelEfficiencyTab } from '@/components/reports/tabs/ChannelEfficiencyTab';
import { EventsReportTab } from '@/components/reports/tabs/EventsReportTab';
import { extractShowrooms, mergePayloads, type MonthlyPayloads } from '@/lib/report-data';

export default function ReportsPage() {
  const { brands } = useBrands();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTabId>('budget-summary');

  // Shared filter state
  const [filters, setFilters] = useState<ReportFilterState>({
    year: 2026, viewMode: 'month', month: new Date().getMonth() + 1,
    brand: '', showroom: '', channel: '',
  });

  // Raw data
  const [plansByMonth, setPlansByMonth] = useState<MonthlyPayloads>({});
  const [actualsByMonth, setActualsByMonth] = useState<MonthlyPayloads>({});
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

  // Extract showrooms from all plan data for filter dropdown
  const showrooms = useMemo(() => {
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    return extractShowrooms(mergePayloads(plansByMonth, allMonths));
  }, [plansByMonth]);

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

        {/* Tab content */}
        {!loading && (
          <>
            {activeTab === 'budget-summary' && (
              <BudgetSummaryTab plansByMonth={plansByMonth} />
            )}
            {activeTab === 'plan-vs-actual' && (
              <PlanVsActualTab
                plansByMonth={plansByMonth}
                actualsByMonth={actualsByMonth}
                viewMode={filters.viewMode}
                month={filters.month}
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
