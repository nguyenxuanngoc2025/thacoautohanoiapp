'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import {
  ClipboardEdit, Save, Send, CheckCircle2, AlertTriangle, Wallet,
  Users, FileSignature, TrendingUp, ChevronDown, ChevronRight, Eye,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useBrands } from '@/contexts/BrandsContext';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchActualEntry, upsertActualEntry } from '@/lib/actual-data';
import { fetchEventsFromDB, type EventItem, type EventsByMonth } from '@/lib/events-data';
import { useShowrooms } from '@/contexts/ShowroomsContext';

// ─── Channels (same as planning) ─────────────────────────────────────────────
const CHANNELS = [
  { name: 'Google',       category: 'DIGITAL',    color: '#EA4335', readonly: false },
  { name: 'Facebook',     category: 'DIGITAL',    color: '#1877F2', readonly: false },
  { name: 'Khác',         category: 'DIGITAL',    color: '#64748B', readonly: false },
  { name: 'Tổng Digital', category: 'DIGITAL',    color: '#0F172A', readonly: true },
  { name: 'Sự kiện',      category: 'SỰ KIỆN',   color: '#10B981', readonly: true },
  { name: 'CSKH',         category: 'CSKH',       color: '#F59E0B', readonly: false },
  { name: 'Nhận diện',    category: 'NHẬN DIỆN',  color: '#8B5CF6', readonly: false },
] as const;

const METRICS = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'];
const COL1_W = 90;
const COL2_W = 120;

// SR_WEIGHTS now provided by useShowrooms().weightMap — see inside component

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function ActualPage() {
  const { brands } = useBrands();
  const { weightMap: SR_WEIGHTS } = useShowrooms();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');

  // Data state
  const [planPayload, setPlanPayload] = useState<Record<string, number>>({});
  const [actualPayload, setActualPayload] = useState<Record<string, number>>({});
  const [actualNotes, setActualNotes] = useState<Record<string, string>>({});
  const [eventsByMonth, setEventsByMonth] = useState<EventsByMonth>({});
  const [status, setStatus] = useState<'draft' | 'submitted' | 'approved'>('draft');

  // UI state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedBrands, setCollapsedBrands] = useState<Set<string>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [budgetPlans, actualEntry, eventsData] = await Promise.all([
      fetchAllBudgetPlans(),
      fetchActualEntry(month, year),
      fetchEventsFromDB(),
    ]);

    // Set plan data for comparison
    const plan = budgetPlans.find(p => p.month === month);
    if (plan) setPlanPayload(plan.payload || {});
    else setPlanPayload({});

    // Set actual data
    if (actualEntry) {
      setActualPayload(actualEntry.payload || {});
      setActualNotes(actualEntry.notes || {});
      setStatus(actualEntry.status as any || 'draft');
    } else {
      setActualPayload({});
      setActualNotes({});
      setStatus('draft');
    }

    setEventsByMonth(eventsData);
  }, [month, year]);

  useEffect(() => {
    loadData().then(() => setMounted(true));
  }, [loadData]);

  // ── Auto-save (debounce 2s) ────────────────────────────────────────────────
  const lastSaved = useRef('');
  useEffect(() => {
    if (!mounted || Object.keys(actualPayload).length === 0) return;
    const sig = JSON.stringify({ actualPayload, actualNotes, status });
    if (sig === lastSaved.current) return;

    setSaveStatus('saving');
    const t = setTimeout(() => {
      upsertActualEntry(month, year, actualPayload, actualNotes, status).then(ok => {
        if (ok) {
          lastSaved.current = sig;
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [actualPayload, actualNotes, status, month, year, mounted]);

  // ── Cell value helpers ───────────────────────────────────────────────────
  const events = eventsByMonth[month] || [];

  const getEventValue = useCallback((brandName: string, modelName: string, metric: string): number => {
    let total = 0;
    for (const ev of events) {
      if (!ev) continue;
      const touchedBrands = brands.filter(db =>
        ev.brands.includes(db.name) || db.models.some(m => ev.brands.includes(m))
      );
      const isGlobal = touchedBrands.length === 0;
      const brandObj = brands.find(b => b.name === brandName);
      if (!brandObj) continue;
      if (!isGlobal && !touchedBrands.includes(brandObj)) continue;

      const numBrands = isGlobal ? brands.length : touchedBrands.length;
      const allModels = brandObj.models.filter(m => {
        const md = brandObj.modelData?.find(x => x.name === m);
        return !md?.is_aggregate;
      });
      const selModels = allModels.filter(m => ev.brands.includes(m));
      const targets = selModels.length > 0 ? selModels : allModels;
      if (!targets.includes(modelName)) continue;

      const fraction = (1 / numBrands) * (1 / targets.length);

      // Use ACTUAL values from events for the actual page
      let val = 0;
      if (metric === 'Ngân sách') val = ev.budgetSpent ?? ev.budget ?? 0;
      else if (metric === 'KHQT') val = ev.leadsActual ?? ev.leads ?? 0;
      else if (metric === 'GDTD') val = ev.gdtdActual ?? ev.gdtd ?? 0;
      else if (metric === 'KHĐ') val = ev.dealsActual ?? ev.deals ?? 0;
      total += val * fraction;
    }
    return total;
  }, [events, brands]);

  const getActualCellValue = useCallback((key: string): number => {
    // Tổng Digital = sum of sub-channels
    if (key.includes('-Tổng Digital-')) {
      return getActualCellValue(key.replace('-Tổng Digital-', '-Google-'))
           + getActualCellValue(key.replace('-Tổng Digital-', '-Facebook-'))
           + getActualCellValue(key.replace('-Tổng Digital-', '-Khác-'));
    }
    // Sự kiện → from events
    const evMark = '-Sự kiện-';
    const evIdx = key.indexOf(evMark);
    if (evIdx !== -1) {
      const bm = key.substring(0, evIdx);
      const metric = key.substring(evIdx + evMark.length);
      const dash = bm.indexOf('-');
      if (dash !== -1) return getEventValue(bm.substring(0, dash), bm.substring(dash + 1), metric);
    }
    // Aggregate models
    for (const b of brands) {
      if (!b.modelData) continue;
      for (const m of b.modelData) {
        if (m.is_aggregate && m.aggregate_group) {
          const prefix = `${b.name}-${m.name}-`;
          if (key.startsWith(prefix)) {
            const suffix = key.slice(prefix.length - 1);
            return b.modelData
              .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
              .reduce((sum, sub) => sum + getActualCellValue(`${b.name}-${sub.name}${suffix}`), 0);
          }
        }
      }
    }
    return actualPayload[key] || 0;
  }, [actualPayload, getEventValue, brands]);

  const getPlanCellValue = useCallback((key: string): number => {
    if (key.includes('-Tổng Digital-')) {
      return getPlanCellValue(key.replace('-Tổng Digital-', '-Google-'))
           + getPlanCellValue(key.replace('-Tổng Digital-', '-Facebook-'))
           + getPlanCellValue(key.replace('-Tổng Digital-', '-Khác-'));
    }
    for (const b of brands) {
      if (!b.modelData) continue;
      for (const m of b.modelData) {
        if (m.is_aggregate && m.aggregate_group) {
          const prefix = `${b.name}-${m.name}-`;
          if (key.startsWith(prefix)) {
            const suffix = key.slice(prefix.length - 1);
            return b.modelData
              .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
              .reduce((sum, sub) => sum + getPlanCellValue(`${b.name}-${sub.name}${suffix}`), 0);
          }
        }
      }
    }
    return planPayload[key] || 0;
  }, [planPayload, brands]);

  // ── KPI totals ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let planBudget = 0, actualBudget = 0;
    let planKhqt = 0, actualKhqt = 0;
    let planGdtd = 0, actualGdtd = 0;
    let planKhd = 0, actualKhd = 0;

    for (const b of brands) {
      for (const model of b.models) {
        const isAgg = b.modelData?.find(x => x.name === model)?.is_aggregate;
        if (isAgg) continue;
        for (const ch of CHANNELS) {
          if (ch.name === 'Tổng Digital') continue;
          const base = `${b.name}-${model}-${ch.name}`;
          planBudget += getPlanCellValue(`${base}-Ngân sách`);
          actualBudget += getActualCellValue(`${base}-Ngân sách`);
          planKhqt += getPlanCellValue(`${base}-KHQT`);
          actualKhqt += getActualCellValue(`${base}-KHQT`);
          planGdtd += getPlanCellValue(`${base}-GDTD`);
          actualGdtd += getActualCellValue(`${base}-GDTD`);
          planKhd += getPlanCellValue(`${base}-KHĐ`);
          actualKhd += getActualCellValue(`${base}-KHĐ`);
        }
      }
    }
    return { planBudget, actualBudget, planKhqt, actualKhqt, planGdtd, actualGdtd, planKhd, actualKhd };
  }, [brands, getPlanCellValue, getActualCellValue]);

  // ── Cell editing ───────────────────────────────────────────────────────────
  const handleStartEdit = (key: string) => {
    if (status === 'approved') return;
    setEditingCell(key);
    setEditValue(actualPayload[key] ? String(actualPayload[key]) : '');
  };

  const handleCommitEdit = () => {
    if (!editingCell) return;
    const isBudget = editingCell.endsWith('-Ngân sách');
    let num = parseFloat(editValue.replace(/,/g, '.')) || 0;
    if (!isBudget) num = Math.max(0, Math.round(num));
    else num = Math.max(0, num);

    setActualPayload(prev => ({ ...prev, [editingCell]: num }));
    setEditingCell(null);
  };

  const toggleBrand = (name: string) => {
    setCollapsedBrands(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // ── Visible channels (simplified: no digital collapse) ─────────────────────
  const visibleChannels = CHANNELS.filter(ch => ch.name !== 'Tổng Digital' || false);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const pct = (actual: number, plan: number) => plan > 0 ? Math.round((actual / plan) * 100) : 0;
  const pctColor = (p: number) => p >= 80 ? '#059669' : p >= 50 ? '#d97706' : '#dc2626';

  const renderKPICard = (icon: any, label: string, planVal: number, actualVal: number, unit: string = '', color: string) => {
    const Icon = icon;
    const p = pct(actualVal, planVal);
    return (
      <div className="panel" style={{ padding: '12px 16px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon size={16} style={{ color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(Math.round(actualVal))}{unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 2 }}>{unit}</span>}
          </span>
          <span style={{ fontSize: 12, color: pctColor(p), fontWeight: 700 }}>
            {p}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>KH: {formatNumber(Math.round(planVal))}{unit}</span>
          <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2 }}>
            <div style={{ width: `${Math.min(p, 100)}%`, height: '100%', background: pctColor(p), borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>
    );
  };

  // ── Grand totals for table footer ──────────────────────────────────────────
  // IMPORTANT: phải đặt TRƯỚC conditional return để không vi phạm Rules of Hooks
  const grandTotals = useMemo(() => {
    const totals: Record<string, { plan: number; actual: number }> = {};
    for (const ch of CHANNELS) {
      if (ch.name === 'Tổng Digital') continue;
      for (const metric of METRICS) {
        const key = `${ch.name}-${metric}`;
        let plan = 0, actual = 0;
        for (const b of brands) {
          for (const model of b.models) {
            const isAgg = b.modelData?.find(x => x.name === model)?.is_aggregate;
            if (isAgg) continue;
            const cellKey = `${b.name}-${model}-${ch.name}-${metric}`;
            plan += getPlanCellValue(cellKey);
            actual += getActualCellValue(cellKey);
          }
        }
        totals[key] = { plan, actual };
      }
    }
    return totals;
  }, [brands, getPlanCellValue, getActualCellValue]);

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Nhập thực hiện"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Save status indicator */}
            {saveStatus === 'saving' && (
              <span style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="spinner" style={{ width: 10, height: 10, border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Đang lưu...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span style={{ fontSize: 11, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} /> Đã lưu
              </span>
            )}

            {/* Status badge */}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
              background: status === 'approved' ? '#ecfdf5' : status === 'submitted' ? '#eff6ff' : '#f8fafc',
              color: status === 'approved' ? '#059669' : status === 'submitted' ? '#2563eb' : '#64748b',
              border: `1px solid ${status === 'approved' ? '#bbf7d0' : status === 'submitted' ? '#bfdbfe' : '#e2e8f0'}`,
            }}>
              {status === 'approved' ? '✓ Đã duyệt' : status === 'submitted' ? '⏳ Chờ duyệt' : '✎ Nháp'}
            </span>

            {status === 'draft' && (
              <button className="button-erp-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  setStatus('submitted');
                  setSaveStatus('saving');
                }}>
                <Send size={13} /> Gửi BLĐ duyệt
              </button>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 20px', gap: 12 }}>

        {/* Row 1: KPI Cards */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {renderKPICard(Wallet, 'Ngân sách (tr)', kpis.planBudget, kpis.actualBudget, ' tr', '#3B82F6')}
          {renderKPICard(Users, 'KHQT', kpis.planKhqt, kpis.actualKhqt, '', '#F59E0B')}
          {renderKPICard(TrendingUp, 'GDTD', kpis.planGdtd, kpis.actualGdtd, '', '#06B6D4')}
          {renderKPICard(FileSignature, 'KHĐ', kpis.planKhd, kpis.actualKhd, '', '#10B981')}
        </div>

        {/* Row 2: Grid */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="toolbar" style={{ borderTop: 'none', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardEdit size={15} style={{ color: '#3B82F6' }} />
              <span style={{ fontWeight: 600 }}>Bảng nhập thực hiện — Tháng {month}/{year}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                (Kênh Sự kiện auto-pull từ Events)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                <Eye size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />KH = Kế hoạch
              </span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}>
                TH = Thực hiện
              </span>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}
            onScroll={(e) => setIsScrolled((e.target as HTMLElement).scrollLeft > 0)}>
            <table className="data-table" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                {/* Channel header */}
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ position: 'sticky', left: 0, zIndex: 12, width: COL1_W, background: '#f8fafc' }}>Hãng</th>
                  <th style={{ position: 'sticky', left: COL1_W, zIndex: 12, width: COL2_W, background: '#f8fafc', borderRight: isScrolled ? '2px solid #cbd5e1' : undefined }}>Dòng xe</th>
                  {visibleChannels.map(ch => (
                    <th key={ch.name} colSpan={METRICS.length} style={{ textAlign: 'center', borderLeft: '2px solid #e2e8f0', fontSize: 11, fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ch.color, display: 'inline-block' }} />
                        {ch.name}
                        {ch.readonly && <span style={{ fontSize: 9, color: '#94a3b8' }}>(auto)</span>}
                      </span>
                    </th>
                  ))}
                </tr>
                {/* Metric sub-header */}
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 12, background: '#fff' }}></th>
                  <th style={{ position: 'sticky', left: COL1_W, zIndex: 12, background: '#fff', borderRight: isScrolled ? '2px solid #cbd5e1' : undefined }}></th>
                  {visibleChannels.map(ch => (
                    METRICS.map(metric => (
                      <th key={`${ch.name}-${metric}`} style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 68, borderLeft: metric === METRICS[0] ? '2px solid #e2e8f0' : undefined }}>
                        {metric === 'Ngân sách' ? 'NS (tr)' : metric}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map(brand => {
                  const isCollapsed = collapsedBrands.has(brand.name);
                  const displayModels = brand.models;

                  // Brand header row with totals
                  return (
                    <React.Fragment key={brand.name}>
                      <tr style={{ background: '#f1f5f9' }}>
                        <td
                          colSpan={2}
                          style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f1f5f9', fontWeight: 700, fontSize: 12, cursor: 'pointer', userSelect: 'none', borderRight: isScrolled ? '2px solid #cbd5e1' : undefined }}
                          onClick={() => toggleBrand(brand.name)}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            {brand.name}
                          </span>
                        </td>
                        {visibleChannels.map(ch => {
                          return METRICS.map(metric => {
                            let planTotal = 0, actualTotal = 0;
                            for (const model of brand.models) {
                              const isAgg = brand.modelData?.find(x => x.name === model)?.is_aggregate;
                              if (isAgg) continue;
                              const key = `${brand.name}-${model}-${ch.name}-${metric}`;
                              planTotal += getPlanCellValue(key);
                              actualTotal += getActualCellValue(key);
                            }
                            const p = pct(actualTotal, planTotal);
                            const isBudget = metric === 'Ngân sách';
                            return (
                              <td key={`${ch.name}-${metric}`} style={{ textAlign: 'right', fontSize: 11, background: '#f1f5f9', borderLeft: metric === METRICS[0] ? '2px solid #e2e8f0' : undefined }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                                  <span style={{ fontWeight: 700, color: actualTotal > 0 ? 'var(--color-text)' : 'transparent' }}>
                                    {actualTotal > 0 ? formatNumber(isBudget ? Math.round(actualTotal * 10) / 10 : Math.round(actualTotal)) : ''}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                    {planTotal > 0 ? `KH: ${formatNumber(isBudget ? Math.round(planTotal * 10) / 10 : Math.round(planTotal))}` : ''}
                                    {planTotal > 0 && actualTotal > 0 && (
                                      <span style={{ color: pctColor(p), marginLeft: 3, fontWeight: 700 }}>{p}%</span>
                                    )}
                                  </span>
                                </div>
                              </td>
                            );
                          });
                        })}
                      </tr>

                      {/* Model rows */}
                      {!isCollapsed && displayModels.map(model => {
                        const isAgg = brand.modelData?.find(x => x.name === model)?.is_aggregate;

                        return (
                          <tr key={`${brand.name}-${model}`} style={{ background: isAgg ? '#fafbfc' : '#fff' }}>
                            <td style={{ position: 'sticky', left: 0, zIndex: 10, background: isAgg ? '#fafbfc' : '#fff' }}></td>
                            <td style={{
                              position: 'sticky', left: COL1_W, zIndex: 10,
                              background: isAgg ? '#fafbfc' : '#fff',
                              borderRight: isScrolled ? '2px solid #cbd5e1' : undefined,
                              fontSize: 12, fontWeight: isAgg ? 600 : 400,
                              fontStyle: isAgg ? 'italic' : 'normal',
                              color: isAgg ? '#64748b' : 'var(--color-text)',
                            }}>
                              {model}
                            </td>
                            {visibleChannels.map(ch => {
                              return METRICS.map(metric => {
                                const cellKey = `${brand.name}-${model}-${ch.name}-${metric}`;
                                const actualVal = getActualCellValue(cellKey);
                                const planVal = getPlanCellValue(cellKey);
                                const isEditing = editingCell === cellKey;
                                const isReadonly = ch.readonly || isAgg || status === 'approved';
                                const isBudget = metric === 'Ngân sách';
                                const displayActual = isBudget ? Math.round(actualVal * 10) / 10 : Math.round(actualVal);
                                const displayPlan = isBudget ? Math.round(planVal * 10) / 10 : Math.round(planVal);

                                return (
                                  <td
                                    key={cellKey}
                                    style={{
                                      textAlign: 'right', fontSize: 11, cursor: isReadonly ? 'default' : 'cell',
                                      background: isEditing ? '#fffbeb' : isAgg ? '#fafbfc' : '#fff',
                                      borderLeft: metric === METRICS[0] ? '2px solid #e2e8f0' : undefined,
                                      position: 'relative', padding: '4px 6px',
                                    }}
                                    onClick={() => !isReadonly && handleStartEdit(cellKey)}
                                  >
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={handleCommitEdit}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleCommitEdit();
                                          if (e.key === 'Escape') setEditingCell(null);
                                        }}
                                        style={{
                                          width: '100%', border: 'none', outline: 'none', background: 'transparent',
                                          textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#92400e',
                                        }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                                        <span style={{ fontWeight: 600, color: displayActual > 0 ? '#92400e' : 'transparent' }}>
                                          {displayActual > 0 ? formatNumber(displayActual) : ''}
                                        </span>
                                        {displayPlan > 0 && (
                                          <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                            {formatNumber(displayPlan)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              });
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Grand total row */}
                <tr className="grand-total" style={{ background: '#f0f9ff' }}>
                  <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f0f9ff', fontWeight: 700, fontSize: 12, borderRight: isScrolled ? '2px solid #cbd5e1' : undefined }}>
                    TỔNG CỘNG
                  </td>
                  {visibleChannels.map(ch => {
                    return METRICS.map(metric => {
                      const key = `${ch.name}-${metric}`;
                      const gt = grandTotals[key] || { plan: 0, actual: 0 };
                      const p = pct(gt.actual, gt.plan);
                      const isBudget = metric === 'Ngân sách';
                      return (
                        <td key={key} style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, background: '#f0f9ff', borderLeft: metric === METRICS[0] ? '2px solid #e2e8f0' : undefined }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                            <span style={{ color: '#1e40af' }}>
                              {gt.actual > 0 ? formatNumber(isBudget ? Math.round(gt.actual * 10) / 10 : Math.round(gt.actual)) : '—'}
                            </span>
                            <span style={{ fontSize: 9, color: '#94a3b8' }}>
                              {gt.plan > 0 ? `KH: ${formatNumber(isBudget ? Math.round(gt.plan * 10) / 10 : Math.round(gt.plan))}` : ''}
                              {gt.plan > 0 && gt.actual > 0 && (
                                <span style={{ color: pctColor(p), marginLeft: 3, fontWeight: 700 }}>{p}%</span>
                              )}
                            </span>
                          </div>
                        </td>
                      );
                    });
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: '6px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0, background: '#f8fafc', fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span><strong>NS TH:</strong> {formatNumber(Math.round(kpis.actualBudget))} tr ({pct(kpis.actualBudget, kpis.planBudget)}% KH)</span>
            <span><strong>KHQT:</strong> {formatNumber(Math.round(kpis.actualKhqt))} ({pct(kpis.actualKhqt, kpis.planKhqt)}%)</span>
            <span><strong>KHĐ:</strong> {formatNumber(Math.round(kpis.actualKhd))} ({pct(kpis.actualKhd, kpis.planKhd)}%)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>
              <Eye size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Dòng dưới = Kế hoạch · Dòng trên = <span style={{ color: '#92400e', fontWeight: 600 }}>Thực hiện</span>
            </span>
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
