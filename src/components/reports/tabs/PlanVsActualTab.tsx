'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import { DataGridContainer } from '@/components/reui/data-grid/data-grid';
import {
  REPORT_CHANNELS, REPORT_METRICS,
  sumByChannelMetric, sumByBrandMetric, sumByModelMetric,
  getMonthsForPeriod, mergePayloads,
  type MonthlyPayloads,
} from '@/lib/report-data';
import type { BrandWithModels } from '@/lib/brands-data';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function calcPct(actual: number, plan: number): number | null {
  if (plan <= 0) return null;
  return Math.round((actual / plan) * 1000) / 10;
}

function fmtVal(v: number, isNS: boolean): string {
  if (v === 0) return '—';
  return formatNumber(isNS ? +(v.toFixed(1)) : Math.round(v));
}

function pctStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return {};
  if (pct >= 100) return { color: '#16a34a', fontWeight: 600 };
  if (pct >= 80)  return { color: '#d97706', fontWeight: 600 };
  return              { color: '#dc2626', fontWeight: 700 };
}

function totalAllChannels(data: Record<string, number>, metric: string): number {
  return (REPORT_CHANNELS as readonly string[]).reduce(
    (s, c) => s + sumByChannelMetric(data, c, metric), 0
  );
}

function computeKPIs(ns: number, khqt: number, gdtd: number, khd: number) {
  return {
    ns, khqt, gdtd, khd,
    cpl:  khqt > 0 ? +(ns / khqt).toFixed(2)         : null,
    cr1:  khqt > 0 ? +(gdtd / khqt * 100).toFixed(1)  : null,
    cr2:  gdtd > 0 ? +(khd  / gdtd * 100).toFixed(1)  : null,
    cphd: khd  > 0 ? +(ns   / khd ).toFixed(2)        : null,
  };
}

function deltaArrow(curr: number | null, prev: number | null, higherIsBetter = true): React.ReactNode {
  if (curr === null || prev === null || prev === 0) return null;
  const up   = curr > prev;
  const good = higherIsBetter ? up : !up;
  const color = good ? '#16a34a' : '#dc2626';
  const pct   = Math.abs(Math.round((curr - prev) / Math.abs(prev) * 100));
  return (
    <span style={{ fontSize: 'var(--fs-label)', color, marginLeft: 3 }}>
      {up ? '↑' : '↓'}{pct}%
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 'var(--fs-table)',
  borderBottom: '1px solid var(--color-border)',
  borderRight: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};
const LABEL_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 1,
  borderRight: '1px solid var(--color-border-dark)',
};
const TOTAL_ROW_BG  = 'var(--color-table-header)';
const BRAND_ROW_BG  = 'var(--color-surface-hover)';
const MODEL_ROW_BG  = 'var(--color-surface)';
const GRP_BORDER    = '1px solid var(--color-border-dark)';
const TH_BASE: React.CSSProperties = {
  ...CELL,
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  background: 'var(--color-table-header)',
  borderBottom: '2px solid var(--color-border-dark)',
  fontSize: 'var(--fs-label)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'quarter' | 'year';
type ReportMode = 'result' | 'efficiency';
interface ShowroomItem { name: string; weight: number; }

export interface FreshnessItem {
  name: string;
  last_updated: string | null;
}

export interface FreshnessData {
  byShowroom: FreshnessItem[];
  byBrand: FreshnessItem[];
}

// ─── FreshnessBar ─────────────────────────────────────────────────────────────

function FreshnessBar({ data, month, viewMode }: {
  data: FreshnessData;
  month: number;
  viewMode: ViewMode;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [activeTab, setActiveTab] = useState<'showroom' | 'brand'>('showroom');

  const items = activeTab === 'showroom' ? data.byShowroom : data.byBrand;
  if (data.byShowroom.length === 0 && data.byBrand.length === 0) return null;

  const now = new Date();

  // Dùng byShowroom để tính summary (luôn có đủ SR)
  const srItems  = data.byShowroom;
  const withData = srItems.filter(i => i.last_updated !== null);
  const updatedToday = withData.filter(i => {
    if (!i.last_updated) return false;
    const d = new Date(i.last_updated);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth()    === now.getMonth()    &&
           d.getDate()     === now.getDate();
  }).length;
  const noData   = srItems.filter(i => i.last_updated === null).length;
  const allItems = [...data.byShowroom, ...data.byBrand];
  const latestTs = allItems.reduce<string | null>(
    (max, i) => (i.last_updated && (!max || i.last_updated > max) ? i.last_updated : max), null
  );

  const periodLabel = viewMode === 'month' ? `T${month}` : viewMode === 'quarter' ? `Q${Math.ceil(month / 3)}` : 'Cả năm';

  function fmtTime(ts: string) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function fmtDateTime(ts: string) {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} ${dd}/${mo}`;
  }

  // So sánh ngày lịch theo local timezone (không dùng raw ms — tránh lỗi UTC offset)
  function localDayStart(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function freshnessInfo(ts: string | null): { label: string; color: string; dot: string } {
    if (!ts) return { label: 'Chưa có dữ liệu', color: '#94a3b8', dot: '#94a3b8' };
    const tsDate   = new Date(ts);
    const diffDays = Math.round((localDayStart(now) - localDayStart(tsDate)) / (1000 * 3600 * 24));
    if (diffDays === 0) return { label: fmtDateTime(ts), color: '#16a34a', dot: '#16a34a' };
    if (diffDays === 1) return { label: fmtDateTime(ts), color: '#d97706', dot: '#d97706' };
    if (diffDays <= 7)  return { label: fmtDateTime(ts), color: '#d97706', dot: '#d97706' };
    return               { label: fmtDateTime(ts),       color: '#dc2626', dot: '#dc2626' };
  }

  return (
    <div style={{ marginBottom: 14, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', fontSize: 'var(--fs-body)' }}>
      {/* Summary bar */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
          background: 'var(--color-surface-hover)', cursor: 'pointer', flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Cập nhật {periodLabel}
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--color-border)', flexShrink: 0 }} />
        {latestTs ? (
          <span style={{ fontSize: 11 }}>
            Mới nhất: <strong style={{ color: '#16a34a' }}>{fmtDateTime(latestTs)}</strong>
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Chưa có dữ liệu</span>
        )}
        <span style={{ width: 1, height: 14, background: 'var(--color-border)', flexShrink: 0 }} />
        <span style={{ fontSize: 11 }}>
          <strong style={{ color: updatedToday > 0 ? '#16a34a' : '#d97706' }}>{updatedToday}/{srItems.length}</strong>
          <span style={{ color: 'var(--color-text-muted)' }}> showroom đã cập nhật hôm nay</span>
        </span>
        {noData > 0 && (
          <>
            <span style={{ width: 1, height: 14, background: 'var(--color-border)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#dc2626' }}>{noData} showroom chưa có dữ liệu</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {expanded ? '▲ Thu gọn' : '▼ Chi tiết'}
        </span>
      </div>

      {/* Detail panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 14px' }}>
            {(['showroom', 'brand'] as const).map(tab => (
              <button
                key={tab}
                onClick={e => { e.stopPropagation(); setActiveTab(tab); }}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: activeTab === tab ? 700 : 400,
                  background: 'transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab === 'showroom' ? 'Theo showroom' : 'Theo thương hiệu'}
              </button>
            ))}
          </div>
          {/* Grid */}
          <div style={{
            padding: '10px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 6,
          }}>
            {items.map(item => {
              const { label, color, dot } = freshnessInfo(item.last_updated);
              return (
                <div key={item.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                  background: 'var(--color-cell-bg)', borderRadius: 6,
                  border: '1px solid var(--color-border)',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 11, color, whiteSpace: 'nowrap' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanVsActualTab({
  plansByMonth, actualsByMonth,
  viewMode, month,
  cmpPlansByMonth, cmpActualsByMonth, cmpMonths,
  compareLabel,
  showroomItems,
  brands,
  showroomMergedData,
  freshnessData,
}: {
  plansByMonth: MonthlyPayloads;
  actualsByMonth: MonthlyPayloads;
  viewMode: ViewMode;
  month: number;
  cmpPlansByMonth: MonthlyPayloads;
  cmpActualsByMonth: MonthlyPayloads;
  cmpMonths: number[];
  compareLabel: string;
  showroomItems: ShowroomItem[];
  brands: BrandWithModels[];
  showroomMergedData?: Record<string, { plan: Record<string, number>; actual: Record<string, number> }>;
  freshnessData?: FreshnessData | null;
}) {
  const [reportMode, setReportMode]         = useState<ReportMode>('result');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty]           = useState(false);

  const months   = useMemo(() => getMonthsForPeriod(viewMode, month), [viewMode, month]);
  const planData = useMemo(() => mergePayloads(plansByMonth,     months),    [plansByMonth, months]);
  const actData  = useMemo(() => mergePayloads(actualsByMonth,   months),    [actualsByMonth, months]);
  const cmpPlan  = useMemo(() => mergePayloads(cmpPlansByMonth,  cmpMonths), [cmpPlansByMonth, cmpMonths]);
  const cmpAct   = useMemo(() => mergePayloads(cmpActualsByMonth, cmpMonths), [cmpActualsByMonth, cmpMonths]);
  const hasCompare = cmpMonths.length > 0;

  function toggleBrand(brand: string) {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  }

  // ── Table header ────────────────────────────────────────────────────────────

  function TableHeader({ labelHeader }: { labelHeader: string }) {
    if (reportMode === 'efficiency') {
      return (
        <thead>
          <tr style={{ background: 'var(--color-table-header)' }}>
            <th style={{ ...TH_BASE, textAlign: 'left', minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>{labelHeader}</th>
            <th style={{ ...TH_BASE, minWidth: 80 }}>NS<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>triệu đ</span></th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>KHQT<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>khách hàng</span></th>
            <th style={{ ...TH_BASE, minWidth: 110 }}>
              Chi phí / KHQT<br />
              <span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                {hasCompare ? `tr/KH · vs ${compareLabel}` : 'tr/KH'}
              </span>
            </th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>GDTD<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>khách hàng</span></th>
            <th style={{ ...TH_BASE, minWidth: 120 }}>Tỷ lệ GDTD / KHQT<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>%</span></th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>KHĐ<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>hợp đồng</span></th>
            <th style={{ ...TH_BASE, minWidth: 110 }}>
              Chi phí / HĐ<br />
              <span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                {hasCompare ? `tr/HĐ · vs ${compareLabel}` : 'tr/HĐ'}
              </span>
            </th>
            <th style={{ ...TH_BASE, minWidth: 120 }}>Tỷ lệ KHĐ / GDTD<br /><span style={{ fontSize: 'var(--fs-label)', fontWeight: 400, color: 'var(--color-text-muted)' }}>%</span></th>
          </tr>
        </thead>
      );
    }

    const colsPerMetric = hasCompare ? 5 : 3;
    return (
      <thead>
        <tr style={{ background: 'var(--color-surface)' }}>
          <th style={{ ...TH_BASE, textAlign: 'left', minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }} rowSpan={2}>
            {labelHeader}
          </th>
          {REPORT_METRICS.map(m => (
            <th key={m} style={{ ...TH_BASE, textAlign: 'center', borderRight: GRP_BORDER }} colSpan={colsPerMetric}>{m}</th>
          ))}
        </tr>
        <tr style={{ background: 'var(--color-surface)' }}>
          {REPORT_METRICS.flatMap(m => {
            const cols = ['KH', 'TH', '%TH'];
            if (hasCompare) cols.push(`TH(${compareLabel})`, '±%');
            return cols.map((c, ci) => (
              <th key={`${m}-${c}`} style={{ ...TH_BASE, minWidth: 60, fontWeight: 600, fontSize: 'var(--fs-label)', ...(ci === cols.length - 1 ? { borderRight: GRP_BORDER } : {}) }}>{c}</th>
            ));
          })}
        </tr>
      </thead>
    );
  }

  // ── KẾT QUẢ row ─────────────────────────────────────────────────────────────

  function renderResultRow(
    label: string,
    isTotal: boolean,
    getter: (data: Record<string, number>, metric: string) => number,
    indent = 0,
    color?: string | null,
    extraLabelContent?: React.ReactNode,
    rowVariant?: 'brand' | 'model',
  ): React.ReactNode {
    const bg = isTotal ? TOTAL_ROW_BG : rowVariant === 'brand' ? BRAND_ROW_BG : rowVariant === 'model' ? MODEL_ROW_BG : 'var(--color-cell-bg)';
    const isBrand = rowVariant === 'brand';
    const isModel = rowVariant === 'model';
    const borderTop = isTotal ? '2px solid var(--color-border-dark)' : isBrand ? '1px solid var(--color-border)' : undefined;
    return (
      <tr key={label} style={{ background: bg, borderTop }}>
        <td style={{
          ...LABEL_CELL,
          background: bg ?? 'var(--color-cell-bg)',
          paddingLeft: 8 + indent * 20,
          fontWeight: isTotal || isBrand ? 700 : 400,
          color: isBrand ? (color ?? 'var(--color-primary)') : isModel ? 'var(--color-text-secondary)' : (color ?? 'var(--color-text)'),
          fontSize: isModel ? 'var(--fs-label)' : 'var(--fs-table)',
          borderTop,
        }}>
          {extraLabelContent}{label}
        </td>
        {REPORT_METRICS.map(m => {
          const isNS   = m === 'Ngân sách';
          const plan   = getter(planData, m);
          const actual = getter(actData,  m);
          const pct    = calcPct(actual, plan);
          const cAct   = hasCompare ? getter(cmpAct,  m) : 0;
          const deltaPct = (hasCompare && actual > 0 && cAct > 0)
            ? Math.round((actual - cAct) / Math.abs(cAct) * 100) : null;
          return (
            <React.Fragment key={m}>
              <td style={{ ...CELL, fontWeight: isTotal ? 700 : 400 }}>{fmtVal(plan, isNS)}</td>
              <td style={{ ...CELL, fontWeight: isTotal ? 700 : actual > 0 ? 600 : 400 }}>{fmtVal(actual, isNS)}</td>
              {!hasCompare ? (
                <td style={{ ...CELL, ...(actual > 0 && pct !== null ? pctStyle(pct) : { color: 'var(--color-text-muted)' }), fontWeight: isTotal && actual > 0 ? 700 : undefined, borderRight: GRP_BORDER }}>
                  {actual > 0 && pct !== null ? `${pct}%` : '—'}
                </td>
              ) : (
                <>
                  <td style={{ ...CELL, ...(actual > 0 && pct !== null ? pctStyle(pct) : { color: 'var(--color-text-muted)' }) }}>
                    {actual > 0 && pct !== null ? `${pct}%` : '—'}
                  </td>
                  <td style={{ ...CELL, color: 'var(--color-text-muted)' }}>{fmtVal(cAct, isNS)}</td>
                  <td style={{ ...CELL, borderRight: GRP_BORDER }}>
                    {deltaPct !== null ? (
                      <span style={{ color: deltaPct >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {deltaPct >= 0 ? '+' : ''}{deltaPct}%
                      </span>
                    ) : '—'}
                  </td>
                </>
              )}
            </React.Fragment>
          );
        })}
      </tr>
    );
  }

  // ── HIỆU QUẢ row ─────────────────────────────────────────────────────────────

  function renderEfficiencyRow(
    label: string,
    isTotal: boolean,
    getter: (data: Record<string, number>, metric: string) => number,
    indent = 0,
    color?: string | null,
    extraLabelContent?: React.ReactNode,
    rowVariant?: 'brand' | 'model',
  ): React.ReactNode {
    const bg = isTotal ? TOTAL_ROW_BG : rowVariant === 'brand' ? BRAND_ROW_BG : rowVariant === 'model' ? MODEL_ROW_BG : 'var(--color-cell-bg)';
    const isBrand = rowVariant === 'brand';
    const isModel = rowVariant === 'model';
    const borderTop = isTotal ? '2px solid var(--color-border-dark)' : isBrand ? '1px solid var(--color-border)' : undefined;
    const ns   = getter(actData, 'Ngân sách');
    const khqt = getter(actData, 'KHQT');
    const gdtd = getter(actData, 'GDTD');
    const khd  = getter(actData, 'KHĐ');
    const kpis = computeKPIs(ns, khqt, gdtd, khd);
    const ck   = hasCompare ? computeKPIs(
      getter(cmpAct, 'Ngân sách'), getter(cmpAct, 'KHQT'),
      getter(cmpAct, 'GDTD'),      getter(cmpAct, 'KHĐ'),
    ) : null;
    const fmtK = (v: number | null, dec = 1) => v === null ? '—' : formatNumber(+v.toFixed(dec));
    return (
      <tr key={label} style={{ background: bg, borderTop }}>
        <td style={{
          ...LABEL_CELL,
          background: bg ?? 'var(--color-cell-bg)',
          paddingLeft: 8 + indent * 20,
          fontWeight: isTotal || isBrand ? 700 : 400,
          color: isBrand ? (color ?? 'var(--color-primary)') : isModel ? 'var(--color-text-secondary)' : (color ?? 'var(--color-text)'),
          fontSize: isModel ? 'var(--fs-label)' : 'var(--fs-table)',
          borderTop,
        }}>
          {extraLabelContent}{label}
        </td>
        <td style={CELL}>{fmtVal(kpis.ns, true)}{hasCompare && deltaArrow(kpis.ns, ck?.ns ?? null, false)}</td>
        <td style={CELL}>{formatNumber(Math.round(kpis.khqt)) || '—'}{hasCompare && deltaArrow(kpis.khqt, ck?.khqt ?? null, true)}</td>
        <td style={CELL}>{fmtK(kpis.cpl, 2)}{hasCompare && deltaArrow(kpis.cpl, ck?.cpl ?? null, false)}</td>
        <td style={CELL}>{formatNumber(Math.round(kpis.gdtd)) || '—'}{hasCompare && deltaArrow(kpis.gdtd, ck?.gdtd ?? null, true)}</td>
        <td style={CELL}>{kpis.cr1 !== null ? `${kpis.cr1}%` : '—'}{hasCompare && deltaArrow(kpis.cr1, ck?.cr1 ?? null, true)}</td>
        <td style={{ ...CELL, fontWeight: 600, color: 'var(--color-success)' }}>{formatNumber(Math.round(kpis.khd)) || '—'}{hasCompare && deltaArrow(kpis.khd, ck?.khd ?? null, true)}</td>
        <td style={CELL}>{fmtK(kpis.cphd, 2)}{hasCompare && deltaArrow(kpis.cphd, ck?.cphd ?? null, false)}</td>
        <td style={CELL}>{kpis.cr2 !== null ? `${kpis.cr2}%` : '—'}{hasCompare && deltaArrow(kpis.cr2, ck?.cr2 ?? null, true)}</td>
      </tr>
    );
  }

  function renderRow(
    label: string,
    isTotal: boolean,
    getter: (data: Record<string, number>, metric: string) => number,
    indent = 0,
    color?: string | null,
    extraLabelContent?: React.ReactNode,
    rowVariant?: 'brand' | 'model',
  ): React.ReactNode {
    return reportMode === 'result'
      ? renderResultRow(label, isTotal, getter, indent, color, extraLabelContent, rowVariant)
      : renderEfficiencyRow(label, isTotal, getter, indent, color, extraLabelContent, rowVariant);
  }

  // ── Section title ────────────────────────────────────────────────────────────

  function SectionTitle({ title }: { title: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 20 }}>
        <div style={{ width: 4, height: 18, background: 'var(--color-primary)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--color-text)' }}>{title}</span>
      </div>
    );
  }

  // ── Table wrapper ────────────────────────────────────────────────────────────

  function renderTable(labelHeader: string, rows: React.ReactNode[]) {
    return (
      <DataGridContainer>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <TableHeader labelHeader={labelHeader} />
            <tbody>{rows}</tbody>
          </table>
        </div>
      </DataGridContainer>
    );
  }

  // ── Sections ─────────────────────────────────────────────────────────────────

  const channelRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    (REPORT_CHANNELS as readonly string[]).forEach(ch => {
      if (hideEmpty) {
        const hasAny = (REPORT_METRICS as readonly string[]).some(
          m => sumByChannelMetric(planData, ch, m) > 0 || sumByChannelMetric(actData, ch, m) > 0
        );
        if (!hasAny) return;
      }
      rows.push(renderRow(ch, false, (d, m) => sumByChannelMetric(d, ch, m)));
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode, hideEmpty]);

  const brandRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    brands.forEach(brand => {
      if (hideEmpty) {
        const hasAny = (REPORT_METRICS as readonly string[]).some(
          m => sumByBrandMetric(planData, brand.name, m) > 0 || sumByBrandMetric(actData, brand.name, m) > 0
        );
        if (!hasAny) return;
      }
      const isExpanded = expandedBrands.has(brand.name);
      const expandIcon = brand.models.length > 0 ? (
        <span
          style={{ marginRight: 6, fontSize: 'var(--fs-label)', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => toggleBrand(brand.name)}
        >
          {isExpanded ? '▼' : '▶'}
        </span>
      ) : null;
      rows.push(renderRow(
        brand.name, false,
        (d, m) => sumByBrandMetric(d, brand.name, m),
        0, brand.color, expandIcon,
        isExpanded ? 'brand' : undefined,
      ));
      if (isExpanded) {
        brand.models.forEach(model => {
          rows.push(renderRow(
            model, false,
            (d, m) => sumByModelMetric(d, brand.name, model, m),
            1, null, undefined, 'model',
          ));
        });
      }
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode, brands, expandedBrands, hideEmpty]);

  const showroomRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    showroomItems.forEach(sr => {
      const srData = showroomMergedData?.[sr.name];
      const hasPlan   = srData ? (REPORT_METRICS as readonly string[]).some(m => totalAllChannels(srData.plan,   m) > 0) : false;
      const hasActual = srData ? (REPORT_METRICS as readonly string[]).some(m => totalAllChannels(srData.actual, m) > 0) : false;
      if (hideEmpty && !hasPlan && !hasActual) return;
      rows.push(renderRow(sr.name, false, (d, m) => {
        if (!srData) return 0;
        if (d === planData) return totalAllChannels(srData.plan, m);
        if (d === actData)  return totalAllChannels(srData.actual, m);
        return 0;
      }));
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode, showroomItems, showroomMergedData, hideEmpty]);

  // ── Export ───────────────────────────────────────────────────────────────────

  function buildExportRows(
    labels: string[],
    getterFn: (label: string) => (data: Record<string, number>, m: string) => number,
  ) {
    return labels.map(label => {
      const getter = getterFn(label);
      const r: Record<string, string | number> = { Nhóm: label };
      REPORT_METRICS.forEach(m => {
        r[`${m}-KH`]  = getter(planData, m);
        r[`${m}-TH`]  = getter(actData,  m);
        const pct = calcPct(getter(actData, m), getter(planData, m));
        r[`${m}-%TH`] = pct !== null ? pct : '';
      });
      return r;
    });
  }

  function handleExport() {
    const chLabels = [...(REPORT_CHANNELS as readonly string[]), 'Tổng cộng'];
    const brLabels = [...brands.map(b => b.name), 'Tổng cộng'];
    exportToExcel([
      { name: 'Theo_Kenh',       rows: buildExportRows(chLabels, label =>
        label === 'Tổng cộng' ? (d, m) => totalAllChannels(d, m) : (d, m) => sumByChannelMetric(d, label, m)) },
      { name: 'Theo_ThuongHieu', rows: buildExportRows(brLabels, label =>
        label === 'Tổng cộng' ? (d, m) => totalAllChannels(d, m) : (d, m) => sumByBrandMetric(d, label, m)) },
    ], 'Bao_cao_Ky_bao_cao');
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const modeBtn = (mode: ReportMode, label: string) => (
    <button key={mode} onClick={() => setReportMode(mode)} style={{
      padding: '4px 14px', border: 'none', cursor: 'pointer',
      fontSize: 'var(--fs-body)', fontWeight: reportMode === mode ? 700 : 400,
      background: reportMode === mode ? 'var(--color-primary)' : 'var(--color-cell-bg)',
      color: reportMode === mode ? '#fff' : 'var(--color-text-muted)',
    }}>
      {label}
    </button>
  );

  return (
    <div>
      {/* Mode switcher + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {modeBtn('result', 'KẾT QUẢ')}
          {modeBtn('efficiency', 'HIỆU QUẢ')}
        </div>
        <button
          onClick={() => setHideEmpty(v => !v)}
          style={{
            padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: 6,
            cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: hideEmpty ? 700 : 400,
            background: hideEmpty ? 'var(--color-primary-light)' : 'var(--color-cell-bg)',
            color: hideEmpty ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          {hideEmpty ? 'Hiện tất cả' : 'Ẩn dòng trống'}
        </button>
        <div style={{ flex: 1 }} />
        <ExportButton onExport={handleExport} />
      </div>

      {/* Freshness bar */}
      {freshnessData && (
        <FreshnessBar data={freshnessData} month={month} viewMode={viewMode} />
      )}

      {/* Section 1: Kênh */}
      <SectionTitle title="Theo kênh Marketing" />
      {renderTable('Kênh', channelRows)}

      {/* Section 2: Thương hiệu */}
      <SectionTitle title="Theo thương hiệu" />
      {renderTable('Thương hiệu', brandRows)}

      {/* Section 3: Showroom */}
      <SectionTitle title="Theo Showroom" />
      {renderTable('Showroom', showroomRows)}
    </div>
  );
}
