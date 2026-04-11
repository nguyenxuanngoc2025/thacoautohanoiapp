'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import {
  FileText, Wallet, Users, TrendingUp, FileSignature, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronRight,
  CalendarCheck, Target, Activity, Zap, Download, Eye, MapPin, Flag,
} from 'lucide-react';
import { useBrands } from '@/contexts/BrandsContext';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchAllActualEntries } from '@/lib/actual-data';
import { fetchEventsFromDB, type EventsByMonth, STATUS_CONFIG, type EventStatus } from '@/lib/events-data';

// ─── Channels (same structure) ──────────────────────────────────────────────
const CHANNELS = [
  { name: 'Google',       category: 'DIGITAL',    color: '#EA4335' },
  { name: 'Facebook',     category: 'DIGITAL',    color: '#1877F2' },
  { name: 'Khác (Digital)', category: 'DIGITAL',  color: '#64748B' },
  { name: 'Sự kiện',      category: 'SỰ KIỆN',   color: '#10B981' },
  { name: 'CSKH',         category: 'CSKH',       color: '#F59E0B' },
  { name: 'Nhận diện',    category: 'NHẬN DIỆN',  color: '#8B5CF6' },
] as const;

const METRICS = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'];

type PayloadData = Record<string, number>;

// ──────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { brands } = useBrands();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');

  // Raw data
  const [plansByMonth, setPlansByMonth] = useState<Record<number, PayloadData>>({});
  const [actualsByMonth, setActualsByMonth] = useState<Record<number, PayloadData>>({});
  const [eventsByMonth, setEventsByMonth] = useState<EventsByMonth>({});

  const loadData = useCallback(async () => {
    const [budgetPlans, actuals, events] = await Promise.all([
      fetchAllBudgetPlans(),
      fetchAllActualEntries(year),
      fetchEventsFromDB(),
    ]);

    const pm: Record<number, PayloadData> = {};
    budgetPlans.forEach(p => { pm[p.month] = p.payload || {}; });
    setPlansByMonth(pm);

    const am: Record<number, PayloadData> = {};
    actuals.forEach(a => { am[a.month] = a.payload || {}; });
    setActualsByMonth(am);

    setEventsByMonth(events);
  }, [year]);

  useEffect(() => {
    loadData().then(() => setMounted(true));
  }, [loadData]);

  // ── Merged data for selected period ────────────────────────────────────────
  const monthsInView = useMemo(() => {
    if (viewMode === 'month') return [month];
    if (viewMode === 'quarter') {
      const q0 = (Math.ceil(month / 3) - 1) * 3 + 1;
      return [q0, q0 + 1, q0 + 2];
    }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [viewMode, month]);

  const planData = useMemo(() => {
    const merged: PayloadData = {};
    monthsInView.forEach(m => {
      const p = plansByMonth[m] || {};
      Object.entries(p).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; });
    });
    return merged;
  }, [plansByMonth, monthsInView]);

  const actualData = useMemo(() => {
    const merged: PayloadData = {};
    monthsInView.forEach(m => {
      const a = actualsByMonth[m] || {};
      Object.entries(a).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; });
    });
    return merged;
  }, [actualsByMonth, monthsInView]);

  const events = useMemo(() => {
    return monthsInView.flatMap(m => eventsByMonth[m] || []);
  }, [eventsByMonth, monthsInView]);

  // ── Aggregate helpers ──────────────────────────────────────────────────────
  const sumByMetric = (data: PayloadData, metric: string) => {
    let total = 0;
    for (const [key, val] of Object.entries(data)) {
      if (key.endsWith(`-${metric}`)) total += val;
    }
    return total;
  };

  const sumByChannel = (data: PayloadData, channelName: string, metric: string) => {
    let total = 0;
    // Map display name to data key
    const dataChannelName = channelName === 'Khác (Digital)' ? 'Khác' : channelName;
    for (const [key, val] of Object.entries(data)) {
      if (key.includes(`-${dataChannelName}-`) && key.endsWith(`-${metric}`)) total += val;
    }
    return total;
  };

  const sumByBrand = (data: PayloadData, brandName: string, metric: string) => {
    let total = 0;
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith(`${brandName}-`) && key.endsWith(`-${metric}`)) total += val;
    }
    return total;
  };

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const pb = sumByMetric(planData, 'Ngân sách');
    const ab = sumByMetric(actualData, 'Ngân sách');
    const pk = sumByMetric(planData, 'KHQT');
    const ak = sumByMetric(actualData, 'KHQT');
    const pg = sumByMetric(planData, 'GDTD');
    const ag = sumByMetric(actualData, 'GDTD');
    const pd = sumByMetric(planData, 'KHĐ');
    const ad = sumByMetric(actualData, 'KHĐ');

    // Event-specific
    const evBudgetPlan = events.reduce((s, e) => s + (e.budget || 0), 0);
    const evBudgetActual = events.reduce((s, e) => s + (e.budgetSpent || 0), 0);
    const evLeadsPlan = events.reduce((s, e) => s + (e.leads || 0), 0);
    const evLeadsActual = events.reduce((s, e) => s + (e.leadsActual || 0), 0);
    const evDealsPlan = events.reduce((s, e) => s + (e.deals || 0), 0);
    const evDealsActual = events.reduce((s, e) => s + (e.dealsActual || 0), 0);

    return {
      planBudget: pb, actualBudget: ab,
      planKhqt: pk, actualKhqt: ak,
      planGdtd: pg, actualGdtd: ag,
      planKhd: pd, actualKhd: ad,
      evBudgetPlan, evBudgetActual, evLeadsPlan, evLeadsActual, evDealsPlan, evDealsActual,
      totalEvents: events.length,
      completedEvents: events.filter(e => e.status === 'completed').length,
    };
  }, [planData, actualData, events]);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const pct = (a: number, p: number) => p > 0 ? Math.round((a / p) * 100) : 0;
  const pctColor = (p: number) => p >= 80 ? '#059669' : p >= 50 ? '#d97706' : '#dc2626';
  const pctBg = (p: number) => p >= 80 ? '#ecfdf5' : p >= 50 ? '#fffbeb' : '#fef2f2';
  const deltaIcon = (a: number, p: number) => {
    const d = pct(a, p);
    if (d >= 100) return <ArrowUpRight size={12} style={{ color: '#059669' }} />;
    if (d >= 80) return <ArrowUpRight size={12} style={{ color: '#d97706' }} />;
    return <ArrowDownRight size={12} style={{ color: '#dc2626' }} />;
  };

  if (!mounted) return null;

  const periodLabel = viewMode === 'month' ? `Tháng ${month}/${year}` : viewMode === 'quarter' ? `Q${Math.ceil(month / 3)}/${year}` : `Năm ${year}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Báo cáo thực hiện"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Kỳ: <strong>{periodLabel}</strong>
            </span>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ═══ Row 1: Executive KPI Cards ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { icon: Wallet, label: 'Ngân sách', planVal: kpis.planBudget, actualVal: kpis.actualBudget, unit: ' tr', color: '#3B82F6' },
            { icon: Users, label: 'KHQT', planVal: kpis.planKhqt, actualVal: kpis.actualKhqt, unit: '', color: '#F59E0B' },
            { icon: TrendingUp, label: 'GDTD', planVal: kpis.planGdtd, actualVal: kpis.actualGdtd, unit: '', color: '#06B6D4' },
            { icon: FileSignature, label: 'KHĐ', planVal: kpis.planKhd, actualVal: kpis.actualKhd, unit: '', color: '#10B981' },
          ].map(({ icon: Icon, label, planVal, actualVal, unit, color }) => {
            const p = pct(actualVal, planVal);
            return (
              <div key={label} className="panel" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={18} style={{ color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: pctBg(p), color: pctColor(p),
                  }}>
                    {p}% đạt
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>KẾ HOẠCH</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(Math.round(planVal))}{unit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#92400e', marginBottom: 2 }}>THỰC HIỆN</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(Math.round(actualVal))}{unit}
                    </div>
                  </div>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ Row 2: Channel Analysis + Conversion Funnel ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>

          {/* Channel Bar Chart */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={15} style={{ color: '#3B82F6' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Ngân sách KH vs TH theo Kênh</span>
            </div>
            <div style={{ padding: 16 }}>
              {CHANNELS.map(ch => {
                const planVal = sumByChannel(planData, ch.name, 'Ngân sách');
                const actualVal = sumByChannel(actualData, ch.name, 'Ngân sách');
                // For "Sự kiện" channel, use events data
                const displayPlan = ch.name === 'Sự kiện' ? kpis.evBudgetPlan : planVal;
                const displayActual = ch.name === 'Sự kiện' ? kpis.evBudgetActual : actualVal;
                const maxVal = Math.max(displayPlan, displayActual, 1);
                const p = pct(displayActual, displayPlan);

                return (
                  <div key={ch.name} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: ch.color, display: 'inline-block' }} />
                        {ch.name}
                      </span>
                      <span style={{ color: pctColor(p), fontWeight: 700, fontSize: 11 }}>{p}%</span>
                    </div>
                    {/* Plan bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: '#94a3b8', width: 20, textAlign: 'right' }}>KH</span>
                      <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(displayPlan / maxVal) * 100}%`, height: '100%', background: `${ch.color}40`, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', width: 50, textAlign: 'right' }}>{formatNumber(Math.round(displayPlan))} tr</span>
                    </div>
                    {/* Actual bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: '#92400e', width: 20, textAlign: 'right', fontWeight: 600 }}>TH</span>
                      <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(displayActual / maxVal) * 100}%`, height: '100%', background: ch.color, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#92400e', width: 50, textAlign: 'right', fontWeight: 600 }}>{formatNumber(Math.round(displayActual))} tr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Funnel — KH vs TH */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={15} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Phễu chuyển đổi: KH vs TH</span>
            </div>
            <div style={{ padding: 16 }}>
              {[
                { label: 'KHQT', sub: 'Khách hàng quan tâm', planVal: kpis.planKhqt, actualVal: kpis.actualKhqt, color: '#3B82F6' },
                { label: 'GDTD', sub: 'Giao dịch theo dõi', planVal: kpis.planGdtd, actualVal: kpis.actualGdtd, color: '#F59E0B' },
                { label: 'KHĐ', sub: 'Ký hợp đồng', planVal: kpis.planKhd, actualVal: kpis.actualKhd, color: '#10B981' },
              ].map((step, i) => {
                const p = pct(step.actualVal, step.planVal);
                const planPct = kpis.planKhqt > 0 ? (step.planVal / kpis.planKhqt * 100) : 100;
                const actualPct = kpis.actualKhqt > 0 ? (step.actualVal / kpis.actualKhqt * 100) : 0;

                return (
                  <div key={step.label} style={{ marginBottom: i < 2 ? 20 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{step.label}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>{step.sub}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(p) }}>{p}%</span>
                    </div>

                    {/* Two side-by-side bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>KH: {formatNumber(Math.round(step.planVal))}</div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(planPct, 100)}%`, height: '100%', background: `${step.color}40`, borderRadius: 2 }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: '#92400e', marginBottom: 2, fontWeight: 600 }}>TH: {formatNumber(Math.round(step.actualVal))}</div>
                        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(actualPct, 100)}%`, height: '100%', background: step.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>

                    {i < 2 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
                        <span>KH CR: {planPct.toFixed(1)}%</span>
                        <span style={{ color: '#92400e' }}>TH CR: {actualPct.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Summary row */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f0f9ff', padding: '8px 10px', borderRadius: 4, textAlign: 'center', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>KH: KHQT→KHĐ</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
                    {kpis.planKhqt > 0 ? (kpis.planKhd / kpis.planKhqt * 100).toFixed(1) : '—'}%
                  </div>
                </div>
                <div style={{ background: '#fef3c7', padding: '8px 10px', borderRadius: 4, textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 10, color: '#92400e', marginBottom: 2 }}>TH: KHQT→KHĐ</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {kpis.actualKhqt > 0 ? (kpis.actualKhd / kpis.actualKhqt * 100).toFixed(1) : '—'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Row 3: Brand × Metric pivot ═══ */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flag size={15} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>So sánh KH / TH theo Thương hiệu</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 100 }}>Thương hiệu</th>
                  {METRICS.map(m => (
                    <React.Fragment key={m}>
                      <th style={{ textAlign: 'right', minWidth: 65, fontSize: 10, borderLeft: '2px solid #e2e8f0' }}>KH {m === 'Ngân sách' ? 'NS' : m}</th>
                      <th style={{ textAlign: 'right', minWidth: 65, fontSize: 10, color: '#92400e' }}>TH {m === 'Ngân sách' ? 'NS' : m}</th>
                      <th style={{ textAlign: 'center', minWidth: 45, fontSize: 10 }}>%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map(brand => {
                  return (
                    <tr key={brand.name}>
                      <td style={{ fontWeight: 600 }}>{brand.name}</td>
                      {METRICS.map(metric => {
                        const planVal = sumByBrand(planData, brand.name, metric);
                        const actualVal = sumByBrand(actualData, brand.name, metric);
                        const p = pct(actualVal, planVal);
                        const isBudget = metric === 'Ngân sách';
                        const fmt = (v: number) => formatNumber(isBudget ? Math.round(v * 10) / 10 : Math.round(v));
                        return (
                          <React.Fragment key={metric}>
                            <td style={{ textAlign: 'right', color: '#94a3b8', borderLeft: '2px solid #e2e8f0' }}>{planVal > 0 ? fmt(planVal) : '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#92400e' }}>{actualVal > 0 ? fmt(actualVal) : '—'}</td>
                            <td style={{ textAlign: 'center' }}>
                              {planVal > 0 && actualVal > 0 ? (
                                <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(p), padding: '1px 6px', borderRadius: 3, background: pctBg(p) }}>
                                  {p}%
                                </span>
                              ) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Grand total */}
                <tr className="grand-total">
                  <td style={{ fontWeight: 700 }}>TỔNG CỘNG</td>
                  {METRICS.map(metric => {
                    const planVal = sumByMetric(planData, metric);
                    const actualVal = sumByMetric(actualData, metric);
                    const p = pct(actualVal, planVal);
                    const isBudget = metric === 'Ngân sách';
                    const fmt = (v: number) => formatNumber(isBudget ? Math.round(v * 10) / 10 : Math.round(v));
                    return (
                      <React.Fragment key={metric}>
                        <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{fmt(planVal)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{fmt(actualVal)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: pctColor(p), padding: '1px 8px', borderRadius: 3, background: pctBg(p), fontSize: 12 }}>
                            {p}%
                          </span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Row 4: Event Performance ═══ */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarCheck size={15} style={{ color: '#10B981' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Hiệu quả sự kiện</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>({kpis.totalEvents} sự kiện · {kpis.completedEvents} hoàn thành)</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: 160 }}>Sự kiện</th>
                  <th style={{ width: 90 }}>Trạng thái</th>
                  <th style={{ width: 100 }}>Showroom</th>
                  <th style={{ width: 60, textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>KH NS</th>
                  <th style={{ width: 60, textAlign: 'right' }}>TH NS</th>
                  <th style={{ width: 45, textAlign: 'center' }}>%</th>
                  <th style={{ width: 55, textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>KH KQ</th>
                  <th style={{ width: 55, textAlign: 'right' }}>TH KQ</th>
                  <th style={{ width: 45, textAlign: 'center' }}>%</th>
                  <th style={{ width: 50, textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>KH HĐ</th>
                  <th style={{ width: 50, textAlign: 'right' }}>TH HĐ</th>
                  <th style={{ width: 45, textAlign: 'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr><td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    Chưa có sự kiện trong kỳ này
                  </td></tr>
                ) : events.map((ev, i) => {
                  const stCfg = STATUS_CONFIG[(ev.status || 'upcoming') as EventStatus] || STATUS_CONFIG.upcoming;
                  const nsPct = pct(ev.budgetSpent || 0, ev.budget || 0);
                  const kqPct = pct(ev.leadsActual || 0, ev.leads || 0);
                  const hdPct = pct(ev.dealsActual || 0, ev.deals || 0);

                  return (
                    <tr key={ev.id}>
                      <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ev.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{ev.date} · {ev.location}</div>
                      </td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, color: stCfg.color }}>{stCfg.label}</span></td>
                      <td style={{ fontSize: 11 }}>{ev.showroom}</td>
                      {/* NS */}
                      <td style={{ textAlign: 'right', color: '#94a3b8', borderLeft: '2px solid #e2e8f0' }}>{ev.budget || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#92400e' }}>{ev.budgetSpent || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {(ev.budget && ev.budgetSpent) ? <span style={{ fontSize: 10, fontWeight: 700, color: pctColor(nsPct) }}>{nsPct}%</span> : '—'}
                      </td>
                      {/* KHQT */}
                      <td style={{ textAlign: 'right', color: '#94a3b8', borderLeft: '2px solid #e2e8f0' }}>{ev.leads || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#92400e' }}>{ev.leadsActual || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {(ev.leads && ev.leadsActual) ? <span style={{ fontSize: 10, fontWeight: 700, color: pctColor(kqPct) }}>{kqPct}%</span> : '—'}
                      </td>
                      {/* KHĐ */}
                      <td style={{ textAlign: 'right', color: '#94a3b8', borderLeft: '2px solid #e2e8f0' }}>{ev.deals || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#92400e' }}>{ev.dealsActual || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {(ev.deals && ev.dealsActual) ? <span style={{ fontSize: 10, fontWeight: 700, color: pctColor(hdPct) }}>{hdPct}%</span> : '—'}
                      </td>
                    </tr>
                  );
                })}

                {/* Event totals */}
                {events.length > 0 && (
                  <tr className="grand-total" style={{ background: '#f0f9ff' }}>
                    <td colSpan={4} style={{ fontWeight: 700 }}>TỔNG CỘNG</td>
                    <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{formatNumber(kpis.evBudgetPlan)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{formatNumber(kpis.evBudgetActual)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: pctColor(pct(kpis.evBudgetActual, kpis.evBudgetPlan)), fontSize: 11 }}>
                        {pct(kpis.evBudgetActual, kpis.evBudgetPlan)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{formatNumber(kpis.evLeadsPlan)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{formatNumber(kpis.evLeadsActual)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: pctColor(pct(kpis.evLeadsActual, kpis.evLeadsPlan)), fontSize: 11 }}>
                        {pct(kpis.evLeadsActual, kpis.evLeadsPlan)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{formatNumber(kpis.evDealsPlan)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{formatNumber(kpis.evDealsActual)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: pctColor(pct(kpis.evDealsActual, kpis.evDealsPlan)), fontSize: 11 }}>
                        {pct(kpis.evDealsActual, kpis.evDealsPlan)}%
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Row 5: Cost Efficiency ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            {
              label: 'CPL (Cost Per Lead)',
              planVal: kpis.planKhqt > 0 ? (kpis.planBudget / kpis.planKhqt * 1_000_000) : 0,
              actualVal: kpis.actualKhqt > 0 ? (kpis.actualBudget / kpis.actualKhqt * 1_000_000) : 0,
              unit: 'đ', color: '#3B82F6', icon: Target, lowerIsBetter: true,
            },
            {
              label: 'CPA (Cost Per Acquisition)',
              planVal: kpis.planKhd > 0 ? (kpis.planBudget / kpis.planKhd * 1_000_000) : 0,
              actualVal: kpis.actualKhd > 0 ? (kpis.actualBudget / kpis.actualKhd * 1_000_000) : 0,
              unit: 'đ', color: '#10B981', icon: Zap, lowerIsBetter: true,
            },
            {
              label: 'Tỷ lệ KHQT → KHĐ',
              planVal: kpis.planKhqt > 0 ? (kpis.planKhd / kpis.planKhqt * 100) : 0,
              actualVal: kpis.actualKhqt > 0 ? (kpis.actualKhd / kpis.actualKhqt * 100) : 0,
              unit: '%', color: '#F59E0B', icon: TrendingUp, lowerIsBetter: false,
            },
            {
              label: 'SL Sự kiện hoàn thành',
              planVal: kpis.totalEvents,
              actualVal: kpis.completedEvents,
              unit: '', color: '#8B5CF6', icon: CalendarCheck, lowerIsBetter: false,
            },
          ].map(({ label, planVal, actualVal, unit, color, icon: Icon, lowerIsBetter }) => {
            const isBetter = lowerIsBetter ? actualVal <= planVal : actualVal >= planVal;
            return (
              <div key={label} className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Icon size={15} style={{ color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>KẾ HOẠCH</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {planVal > 0 ? formatNumber(Math.round(planVal)) : '—'}{unit && planVal > 0 ? <span style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>{unit}</span> : ''}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#92400e' }}>THỰC HIỆN</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: actualVal > 0 ? (isBetter ? '#059669' : '#dc2626') : 'var(--color-text)' }}>
                      {actualVal > 0 ? formatNumber(Math.round(actualVal)) : '—'}{unit && actualVal > 0 ? <span style={{ fontSize: 10, fontWeight: 400 }}>{unit}</span> : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
