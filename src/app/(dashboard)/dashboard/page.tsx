'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchAllActualEntries } from '@/lib/actual-data';
import { fetchEventsFromDB } from '@/lib/events-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';
import dynamic from 'next/dynamic';

const BudgetBarChart = dynamic(() => import('@/components/charts/ChartComponents').then(mod => mod.BudgetBarChart), { ssr: false, loading: () => <div style={{height: 250, background: '#f8fafc', borderRadius: 8}} /> });
const DonutChart = dynamic(() => import('@/components/charts/ChartComponents').then(mod => mod.DonutChart), { ssr: false, loading: () => <div style={{height: 200, background: '#f8fafc', borderRadius: 8, marginTop: 16}} /> });
import {
  Users, UserCheck, FileSignature, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, ChevronUp, ChevronDown,
  CalendarDays,
} from 'lucide-react';

const DONUT_COLORS = ['#3b82f6','#10b981','#f59e0b','#6366f1','#ec4899','#06b6d4'];
const CHANNELS = ['Google', 'Facebook', 'Khác', 'CSKH', 'Nhận diện'];

// ── Spark line inline SVG ─────────────────────────────────────────────────────
function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const W = 64, H = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H * 0.85 - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={parseFloat(pts.split(' ').at(-1)!.split(',')[0])} cy={parseFloat(pts.split(' ').at(-1)!.split(',')[1])} r={2.5} fill={color} />
    </svg>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ pct }: { pct: number }) {
  if (pct > 100) return <XCircle size={14} style={{ color: 'var(--color-danger)' }} />;
  if (pct > 80) return <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />;
  return <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />;
}

// ── Parse event date → Date ───────────────────────────────────────────────────
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (!d || !m || !y) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export default function DashboardPage() {
  const { brands } = useBrands();
  const { showrooms } = useShowrooms();
  const { activeUnitId } = useUnit();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');

  const [plansByMonth, setPlansByMonth] = useState<Record<number, Record<string, number>>>({});
  const [actualsByMonth, setActualsByMonth] = useState<Record<number, Record<string, number>>>({});
  const [eventsData, setEventsData] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    const [budgetPlans, actuals, eventsObj] = await Promise.all([
      fetchAllBudgetPlans(activeUnitId),
      fetchAllActualEntries(year, activeUnitId),
      fetchEventsFromDB(activeUnitId),
    ]);
    const pm: Record<number, Record<string, number>> = {};
    const am: Record<number, Record<string, number>> = {};
    
    if (budgetPlans && budgetPlans.length > 0) {
      budgetPlans.forEach(p => { pm[p.month] = p.payload || {}; });
    }
    setPlansByMonth(pm);
    
    if (actuals && actuals.length > 0) {
      actuals.forEach(a => { am[a.month] = a.payload || {}; });
    }
    setActualsByMonth(am);
    
    setEventsData(eventsObj ? Object.values(eventsObj).flat() : []);
  }, [year, activeUnitId]);

  useEffect(() => { loadData().then(() => setMounted(true)); }, [loadData]);

  const monthsInView = useMemo(() => {
    if (viewMode === 'month') return [month];
    if (viewMode === 'quarter') {
      const q0 = (Math.ceil(month / 3) - 1) * 3 + 1;
      return [q0, q0 + 1, q0 + 2];
    }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [viewMode, month]);

  const planData = useMemo(() => {
    const merged: Record<string, number> = {};
    monthsInView.forEach(m => { Object.entries(plansByMonth[m] || {}).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; }); });
    return merged;
  }, [plansByMonth, monthsInView]);

  const actualData = useMemo(() => {
    const merged: Record<string, number> = {};
    monthsInView.forEach(m => { Object.entries(actualsByMonth[m] || {}).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; }); });
    return merged;
  }, [actualsByMonth, monthsInView]);

  const eventsInView = useMemo(() => {
    return eventsData.filter(e => {
      if (!e.date) return false;
      let evY: number, evM: number;
      if (e.date.includes('/')) {
        const parts = e.date.split('/');
        evY = parseInt(parts[2]); evM = parseInt(parts[1]);
      } else {
        const parts = e.date.split('-');
        evY = parseInt(parts[0]); evM = parseInt(parts[1]);
      }
      if (isNaN(evY) || isNaN(evM) || evY !== year) return false;
      return monthsInView.includes(evM);
    });
  }, [eventsData, year, monthsInView]);

  const sumByMetric = useCallback((data: Record<string, number>, metric: string, excludeEvent = false) => {
    let total = 0;
    for (const [k, v] of Object.entries(data)) {
      if (k.endsWith(`-${metric}`)) {
        if (excludeEvent && k.includes('-Sự kiện-')) continue;
        total += v;
      }
    }
    return total;
  }, []);

  const sumByChannelValue = useCallback((data: Record<string, number>, chName: string) => {
    let total = 0;
    const name = chName === 'Khác (Digital)' ? 'Khác' : chName;
    for (const [k, v] of Object.entries(data)) {
      if (k.includes(`-${name}-`) && k.endsWith('-Ngân sách')) total += v;
    }
    return total;
  }, []);

  // ── Spark data: last 5 months actuals ─────────────────────────────────────
  const sparkData = useMemo(() => {
    const last5 = Array.from({ length: 5 }, (_, i) => {
      const m = month - 4 + i;
      return m < 1 ? m + 12 : m;
    });
    return {
      budget: last5.map(m => { const d = actualsByMonth[m] || {}; return Object.entries(d).filter(([k]) => k.endsWith('-Ngân sách')).reduce((s, [, v]) => s + v, 0); }),
      khqt:   last5.map(m => { const d = actualsByMonth[m] || {}; return Object.entries(d).filter(([k]) => k.endsWith('-KHQT')).reduce((s, [, v]) => s + v, 0); }),
      gdtd:   last5.map(m => { const d = actualsByMonth[m] || {}; return Object.entries(d).filter(([k]) => k.endsWith('-GDTD')).reduce((s, [, v]) => s + v, 0); }),
      khd:    last5.map(m => { const d = actualsByMonth[m] || {}; return Object.entries(d).filter(([k]) => k.endsWith('-KHĐ')).reduce((s, [, v]) => s + v, 0); }),
    };
  }, [actualsByMonth, month]);

  const showroomBreakdown = useMemo(() => {
    const gbPlan = sumByMetric(planData, 'Ngân sách', true);
    const gbActual = sumByMetric(actualData, 'Ngân sách', true);
    const gKhqtP = sumByMetric(planData, 'KHQT', true);
    const gKhqtA = sumByMetric(actualData, 'KHQT', true);
    const gGdtdP = sumByMetric(planData, 'GDTD', true);
    const gGdtdA = sumByMetric(actualData, 'GDTD', true);
    const gKhdP = sumByMetric(planData, 'KHĐ', true);
    const gKhdA = sumByMetric(actualData, 'KHĐ', true);

    return showrooms.map(sr => {
      const w = sr.weight;
      const evs = eventsInView.filter(e => e.showroom === sr.name);
      const evBudgetPlan    = evs.reduce((s, e) => s + (e.budget || 0), 0);
      const evBudgetActual  = evs.reduce((s, e) => s + (e.budgetSpent || 0), 0);
      const evKhqtActual    = evs.reduce((s, e) => s + (e.leadsActual || 0), 0);
      const evGdtdActual    = evs.reduce((s, e) => s + (e.gdtdActual || 0), 0);
      const evKhdActual     = evs.reduce((s, e) => s + (e.dealsActual || 0), 0);

      const planNS   = (gbPlan * w) + evBudgetPlan;
      const actualNS = (gbActual * w) + evBudgetActual;
      const khqt     = (gKhqtA * w) + evKhqtActual;
      const gdtd     = (gGdtdA * w) + evGdtdActual;
      const khd      = (gKhdA * w) + evKhdActual;

      return { name: sr.name, plan: planNS, actual: actualNS, khqt, gdtd, khd };
    });
  }, [planData, actualData, eventsInView, sumByMetric, showrooms]);

  const channelBreakdown = useMemo(() => {
    const list = CHANNELS.map(name => ({ name, amount: sumByChannelValue(actualData, name) }));
    const evAmt = eventsInView.reduce((s, e) => s + (e.budgetSpent || 0), 0);
    list.push({ name: 'Sự kiện', amount: evAmt });
    const total = list.reduce((s, c) => s + c.amount, 0);
    return list.map((ch, i) => ({ ...ch, color: DONUT_COLORS[i % DONUT_COLORS.length], pct: total > 0 ? Math.round((ch.amount / total) * 100) : 0 })).sort((a, b) => b.amount - a.amount);
  }, [actualData, eventsInView, sumByChannelValue]);

  const barChartData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const plan   = Object.entries(plansByMonth[m]   || {}).filter(([k]) => k.endsWith('-Ngân sách')).reduce((s, [, v]) => s + v, 0);
    const actual = Object.entries(actualsByMonth[m] || {}).filter(([k]) => k.endsWith('-Ngân sách')).reduce((s, [, v]) => s + v, 0);
    return { month: m, plan, actual };
  }), [plansByMonth, actualsByMonth]);

  if (!mounted) return null;

  const totalPlan   = showroomBreakdown.reduce((s, r) => s + r.plan, 0);
  const totalActual = showroomBreakdown.reduce((s, r) => s + r.actual, 0);
  const totalKhqt   = showroomBreakdown.reduce((s, r) => s + r.khqt, 0);
  const totalGdtd   = showroomBreakdown.reduce((s, r) => s + r.gdtd, 0);
  const totalKhd    = showroomBreakdown.reduce((s, r) => s + r.khd, 0);
  const cpl         = totalKhqt > 0 ? (totalActual / totalKhqt) : 0;
  const budgetPct   = totalPlan > 0 ? (totalActual / totalPlan * 100) : 0;
  const pKhqt       = sumByMetric(planData, 'KHQT');
  const pGdtd       = sumByMetric(planData, 'GDTD');
  const pKhd        = sumByMetric(planData, 'KHĐ');
  const pBudget     = sumByMetric(planData, 'Ngân sách');

  // Alerts: showrooms over budget (> 100%), sorted by overage
  const alertShowrooms = showroomBreakdown
    .filter(sr => sr.plan > 0 && (sr.actual / sr.plan) > 1)
    .sort((a, b) => (b.actual / b.plan) - (a.actual / a.plan))
    .slice(0, 3);

  // Upcoming events (future, sorted by date)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingEvents = eventsData
    .map(e => ({ ...e, _date: parseEventDate(e.date) }))
    .filter(e => e._date && e._date >= today)
    .sort((a, b) => a._date!.getTime() - b._date!.getTime())
    .slice(0, 4);

  const deltaColor = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return 'var(--color-text-muted)';
    const up = val >= plan;
    if (higherIsBad) return up ? 'var(--color-danger)' : 'var(--color-success)';
    return up ? 'var(--color-success)' : 'var(--color-danger)';
  };
  const deltaBg = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return '#f1f5f9';
    const up = val >= plan;
    if (higherIsBad) return up ? '#fef2f2' : '#ecfdf5';
    return up ? '#ecfdf5' : '#fef2f2';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: 8 }}>
      <PageHeader
        title="Tổng quan ngân sách toàn đơn vị"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'auto' }}>

        {/* ── ROW 1: KPI Grid ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: 8 }}>

          {/* Hero — Ngân sách */}
          <div style={{
            background: 'var(--color-primary)', borderRadius: 'var(--border-radius-md)',
            padding: '14px 16px', position: 'relative', overflow: 'hidden',
            border: '1px solid #003d82', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ngân sách thực hiện
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                background: budgetPct > 100 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                color: budgetPct > 100 ? '#fca5a5' : '#6ee7b7',
              }}>
                {budgetPct > 100 ? '↑' : '↓'} {Math.abs(budgetPct - 100).toFixed(0)}% vs KH
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {formatNumber(Math.round(totalActual))}
              <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>triệu đ</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Kế hoạch: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{formatNumber(Math.round(pBudget))} tr</strong>
              {totalActual > pBudget && (
                <span style={{ marginLeft: 6, color: '#fca5a5' }}>↑ vượt {formatNumber(Math.round(totalActual - pBudget))} tr</span>
              )}
            </div>
            {/* Progress bar */}
            <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'rgba(255,255,255,0.75)', width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>0%</span>
              <span style={{ color: budgetPct > 100 ? '#fca5a5' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                {budgetPct.toFixed(0)}% đạt
              </span>
              <span>KH</span>
            </div>
          </div>

          {/* KHQT */}
          <KpiCard
            label="Khách quan tâm" value={totalKhqt} plan={pKhqt}
            icon={<Users size={14} strokeWidth={2} />} iconBg="#eff6ff" iconColor="#3b82f6"
            spark={sparkData.khqt} sparkColor="#3b82f6" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg}
          />

          {/* GDTD */}
          <KpiCard
            label="Giao dịch theo dõi" value={totalGdtd} plan={pGdtd}
            icon={<UserCheck size={14} strokeWidth={2} />} iconBg="#fffbeb" iconColor="#f59e0b"
            spark={sparkData.gdtd} sparkColor="#f59e0b" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg}
          />

          {/* KHĐ */}
          <KpiCard
            label="Ký hợp đồng" value={totalKhd} plan={pKhd}
            icon={<FileSignature size={14} strokeWidth={2} />} iconBg="#ecfdf5" iconColor="#10b981"
            spark={sparkData.khd} sparkColor="#10b981" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg}
          />

          {/* CPL */}
          <div className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cost Per Lead
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={14} color="var(--color-primary)" strokeWidth={2} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {cpl > 0 ? cpl.toFixed(2) : <span style={{ color: 'var(--color-text-muted)' }}>— —</span>}
              {cpl > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 3 }}>tr/lead</span>}
            </div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
              CPA: <strong style={{ color: 'var(--color-primary)' }}>
                {totalKhd > 0 ? (totalActual / totalKhd).toFixed(1) : '—'} tr/sale
              </strong>
            </div>
            <div style={{ marginTop: 4 }}>
              <SparkLine values={sparkData.budget.map((b, i) => sparkData.khqt[i] > 0 ? b / sparkData.khqt[i] : 0)} color="var(--color-primary)" />
            </div>
          </div>
        </div>

        {/* ── ROW 2: Showroom table + Funnel + Alerts/Events ─────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.85fr', gap: 8 }}>

          {/* Showroom table */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="toolbar" style={{ borderTop: 'none', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                Hiệu quả chi tiêu theo Showroom — {viewMode === 'month' ? `Tháng ${month}/${year}` : `Năm ${year}`}
              </div>
            </div>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Showroom</th>
                    <th style={{ textAlign: 'right' }}>KH (tr)</th>
                    <th style={{ textAlign: 'right' }}>TH (tr)</th>
                    <th style={{ textAlign: 'right' }}>%Chi</th>
                    <th style={{ textAlign: 'right' }}>KHQT</th>
                    <th style={{ textAlign: 'right' }}>GDTD</th>
                    <th style={{ textAlign: 'right' }}>KHĐ</th>
                    <th style={{ textAlign: 'right' }}>CPL (tr)</th>
                    <th style={{ textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {showroomBreakdown.map((sr) => {
                    const pct = sr.plan > 0 ? (sr.actual / sr.plan * 100) : 0;
                    const srCpl = sr.khqt > 0 ? (sr.actual / sr.khqt) : 0;
                    const pctColor = pct > 100 ? 'var(--color-danger)' : pct > 80 ? 'var(--color-warning)' : 'var(--color-success)';
                    return (
                      <tr key={sr.name}>
                        <td style={{ fontWeight: 500 }}>{sr.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{formatNumber(Math.round(sr.plan))}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: pct > 100 ? '#92400e' : 'var(--color-text)' }}>{formatNumber(Math.round(sr.actual))}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: pctColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(sr.khqt))}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatNumber(Math.round(sr.gdtd))}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(Math.round(sr.khd))}</td>
                        <td style={{ textAlign: 'right' }}>{srCpl > 0 ? srCpl.toFixed(1) : '—'}</td>
                        <td style={{ textAlign: 'center' }}><StatusIcon pct={pct} /></td>
                      </tr>
                    );
                  })}
                  <tr className="grand-total">
                    <td style={{ fontWeight: 700 }}>TỔNG CỘNG</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalPlan))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNumber(Math.round(totalActual))}</td>
                    <td style={{ textAlign: 'right' }}>{budgetPct.toFixed(0)}%</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalKhqt))}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalGdtd))}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalKhd))}</td>
                    <td style={{ textAlign: 'right' }}>{cpl > 0 ? cpl.toFixed(1) : '—'}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Funnel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="panel" style={{ flex: 1 }}>
              <div className="toolbar" style={{ borderTop: 'none' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Phễu chuyển đổi</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                {[
                  { label: 'KHQT', sublabel: 'Quan tâm', value: totalKhqt, plan: pKhqt, color: 'var(--color-info)', pct: 100 },
                  { label: 'GDTD', sublabel: 'Theo dõi',   value: totalGdtd, plan: pGdtd, color: 'var(--color-warning)', pct: totalKhqt > 0 ? totalGdtd / totalKhqt * 100 : 0 },
                  { label: 'KHĐ',  sublabel: 'Ký HĐ',      value: totalKhd,  plan: pKhd,  color: 'var(--color-success)', pct: totalKhqt > 0 ? totalKhd  / totalKhqt * 100 : 0 },
                ].map((step, i) => (
                  <div key={step.label} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>{step.label}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{step.sublabel}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{formatNumber(Math.round(step.value))}</span>
                    </div>
                    {/* Plan bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, width: 18 }}>KH</span>
                      <div style={{ flex: 1, height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: 'var(--color-border-dark)', width: `${step.plan > 0 ? Math.min(step.plan / (pKhqt || 1) * 100, 100) : 0}%` }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 36, textAlign: 'right' }}>{formatNumber(Math.round(step.plan))}</span>
                    </div>
                    {/* Actual bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, width: 18 }}>TH</span>
                      <div style={{ flex: 1, height: 5, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: step.color, width: `${step.plan > 0 ? Math.min(step.value / (pKhqt || 1) * 100, 100) : 0}%` }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text)', width: 36, textAlign: 'right' }}>{formatNumber(Math.round(step.value))}</span>
                    </div>
                    {i < 2 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'right', marginTop: 2 }}>
                        Chuyển đổi: {step.pct.toFixed(1)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Donut + channel */}
            <div className="panel">
              <div className="toolbar" style={{ borderTop: 'none' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Phân bổ Kênh</span>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0 }}>
                  <DonutChart data={channelBreakdown.map(ch => ({ name: ch.name, value: ch.amount, color: ch.color }))} size={90} innerRadius={28} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                  {channelBreakdown.map(ch => (
                    <div key={ch.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: ch.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>{ch.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alerts + Upcoming Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Alerts — over budget showrooms */}
            <div className="panel">
              <div className="toolbar" style={{ borderTop: 'none' }}>
                <AlertTriangle size={13} color="var(--color-danger)" />
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Vượt ngân sách</span>
              </div>
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {alertShowrooms.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', color: 'var(--color-success)' }}>
                    <CheckCircle size={13} />
                    <span style={{ fontSize: 12 }}>Tất cả showroom trong ngân sách</span>
                  </div>
                ) : alertShowrooms.map(sr => {
                  const pct = sr.plan > 0 ? (sr.actual / sr.plan * 100) : 0;
                  const over = sr.actual - sr.plan;
                  return (
                    <div key={sr.name} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 9px',
                      borderRadius: 4, borderLeft: '3px solid var(--color-danger)',
                      background: '#fef2f2',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sr.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                          Vượt {formatNumber(Math.round(over))} tr
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', flexShrink: 0 }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming events */}
            <div className="panel" style={{ flex: 1 }}>
              <div className="toolbar" style={{ borderTop: 'none' }}>
                <CalendarDays size={13} color="var(--color-primary)" />
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Sự kiện sắp tới</span>
              </div>
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {upcomingEvents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '6px 0' }}>Không có sự kiện sắp tới</div>
                ) : upcomingEvents.map((ev, i) => {
                  const d = ev._date as Date;
                  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                  const urgBg   = diff <= 3 ? '#fef2f2' : diff <= 7 ? '#fffbeb' : '#eff6ff';
                  const urgClr  = diff <= 3 ? '#991b1b' : diff <= 7 ? '#92400e' : '#1e40af';
                  const urgTxt  = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff <= 3 ? `${diff} ngày` : `${diff}n`;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid var(--color-border)', alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--color-primary)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8 }}>T{d.getMonth() + 1}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name || ev.eventName || 'Sự kiện'}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{ev.showroom || ''}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 10, background: urgBg, color: urgClr, flexShrink: 0 }}>{urgTxt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3: Bar chart 12 tháng ─────────────────────────────────── */}
        <div className="panel">
          <div className="toolbar" style={{ borderTop: 'none' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Ngân sách 12 tháng / {year}</span>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <BudgetBarChart data={barChartData} highlightMonth={month} height={130} />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── KPI Card component ────────────────────────────────────────────────────────
function KpiCard({
  label, value, plan, icon, iconBg, iconColor,
  spark, sparkColor, higherIsBad, deltaColor, deltaBg,
}: {
  label: string; value: number; plan: number;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  spark: number[]; sparkColor: string; higherIsBad: boolean;
  deltaColor: (v: number, p: number, bad: boolean) => string;
  deltaBg: (v: number, p: number, bad: boolean) => string;
}) {
  const delta = plan > 0 ? ((value - plan) / plan * 100) : 0;
  const isUp = delta >= 0;
  const clr = deltaColor(value, plan, higherIsBad);
  const bg  = deltaBg(value, plan, higherIsBad);
  return (
    <div className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: iconColor }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value > 0 ? formatNumber(Math.round(value)) : <span style={{ color: 'var(--color-text-muted)' }}>— —</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: bg, color: clr }}>
          {isUp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {Math.abs(delta).toFixed(1)}%
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>vs KH {formatNumber(Math.round(plan))}</span>
      </div>
      <div style={{ marginTop: 2 }}>
        <SparkLine values={spark} color={sparkColor} />
      </div>
    </div>
  );
}
