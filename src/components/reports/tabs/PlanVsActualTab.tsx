'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
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
  if (pct >= 100) return { color: '#16a34a', background: '#f0fdf4', borderRadius: 4, padding: '0 4px' };
  if (pct >= 80)  return { color: '#d97706', background: '#fffbeb', borderRadius: 4, padding: '0 4px' };
  return              { color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '0 4px' };
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
  padding: '5px 8px',
  fontSize: 'var(--fs-table)',
  borderBottom: '1px solid var(--color-border-light)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
};
const LABEL_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 1,
};
const TOTAL_ROW_BG = '#eef2f8';
const TH_BASE: React.CSSProperties = {
  ...CELL,
  fontWeight: 700,
  color: 'var(--color-text)',
  background: '#f8fafc',
  borderBottom: '1px solid var(--color-border)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'quarter' | 'year';
type ReportMode = 'result' | 'efficiency';
interface ShowroomItem { name: string; weight: number; }

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanVsActualTab({
  plansByMonth, actualsByMonth,
  viewMode, month,
  cmpPlansByMonth, cmpActualsByMonth, cmpMonths,
  compareLabel,
  showroomItems,
  brands,
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
}) {
  const [reportMode, setReportMode]     = useState<ReportMode>('result');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

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
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...TH_BASE, textAlign: 'left', minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>{labelHeader}</th>
            <th style={{ ...TH_BASE, minWidth: 80 }}>NS (tr đ)</th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>KHQT</th>
            <th style={{ ...TH_BASE, minWidth: 80 }}>
              CPL (tr/lead)
              {hasCompare && <><br /><span style={{ fontSize: 'var(--fs-label)', color: '#94a3b8', fontWeight: 400 }}>vs {compareLabel}</span></>}
            </th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>CR1%</th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>CR2%</th>
            <th style={{ ...TH_BASE, minWidth: 70 }}>KHĐ</th>
          </tr>
        </thead>
      );
    }

    const colsPerMetric = hasCompare ? 5 : 3;
    return (
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          <th style={{ ...TH_BASE, textAlign: 'left', minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }} rowSpan={2}>
            {labelHeader}
          </th>
          {REPORT_METRICS.map(m => (
            <th key={m} style={{ ...TH_BASE, textAlign: 'center' }} colSpan={colsPerMetric}>{m}</th>
          ))}
        </tr>
        <tr style={{ background: '#f8fafc' }}>
          {REPORT_METRICS.flatMap(m => {
            const cols = ['KH', 'TH', '%TH'];
            if (hasCompare) cols.push(`TH(${compareLabel})`, '±%');
            return cols.map(c => (
              <th key={`${m}-${c}`} style={{ ...TH_BASE, minWidth: 60, fontWeight: 600, fontSize: 'var(--fs-label)' }}>{c}</th>
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
  ): React.ReactNode {
    const bg = isTotal ? TOTAL_ROW_BG : undefined;
    return (
      <tr key={label} style={{ background: bg }}>
        <td style={{ ...LABEL_CELL, background: bg ?? '#fff', paddingLeft: 8 + indent * 16, fontWeight: isTotal ? 700 : 400, color: color ?? 'var(--color-text)' }}>
          {extraLabelContent}{label}
        </td>
        {REPORT_METRICS.map(m => {
          const isNS   = m === 'Ngân sách';
          const plan   = getter(planData, m);
          const actual = getter(actData,  m);
          const pct    = calcPct(actual, plan);
          const cAct   = hasCompare ? getter(cmpAct,  m) : 0;
          const cPlan  = hasCompare ? getter(cmpPlan, m) : 0;
          const deltaPct = (hasCompare && actual > 0 && cAct > 0)
            ? Math.round((actual - cAct) / Math.abs(cAct) * 100) : null;
          return (
            <React.Fragment key={m}>
              <td style={CELL}>{fmtVal(plan, isNS)}</td>
              <td style={{ ...CELL, fontWeight: actual > 0 ? 600 : 400 }}>{fmtVal(actual, isNS)}</td>
              <td style={{ ...CELL, ...pctStyle(pct) }}>{pct !== null ? `${pct}%` : '—'}</td>
              {hasCompare && (
                <>
                  <td style={{ ...CELL, color: 'var(--color-text-muted)' }}>{fmtVal(cAct, isNS)}</td>
                  <td style={CELL}>
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
  ): React.ReactNode {
    const bg   = isTotal ? TOTAL_ROW_BG : undefined;
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
      <tr key={label} style={{ background: bg }}>
        <td style={{ ...LABEL_CELL, background: bg ?? '#fff', paddingLeft: 8 + indent * 16, fontWeight: isTotal ? 700 : 400, color: color ?? 'var(--color-text)' }}>
          {extraLabelContent}{label}
        </td>
        <td style={CELL}>{fmtVal(kpis.ns, true)}{hasCompare && deltaArrow(kpis.ns, ck?.ns ?? null, false)}</td>
        <td style={CELL}>{formatNumber(Math.round(kpis.khqt)) || '—'}{hasCompare && deltaArrow(kpis.khqt, ck?.khqt ?? null, true)}</td>
        <td style={CELL}>{fmtK(kpis.cpl, 2)}{hasCompare && deltaArrow(kpis.cpl, ck?.cpl ?? null, false)}</td>
        <td style={CELL}>{kpis.cr1 !== null ? `${kpis.cr1}%` : '—'}{hasCompare && deltaArrow(kpis.cr1, ck?.cr1 ?? null, true)}</td>
        <td style={CELL}>{kpis.cr2 !== null ? `${kpis.cr2}%` : '—'}{hasCompare && deltaArrow(kpis.cr2, ck?.cr2 ?? null, true)}</td>
        <td style={{ ...CELL, fontWeight: 600 }}>{formatNumber(Math.round(kpis.khd)) || '—'}{hasCompare && deltaArrow(kpis.khd, ck?.khd ?? null, true)}</td>
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
  ): React.ReactNode {
    return reportMode === 'result'
      ? renderResultRow(label, isTotal, getter, indent, color, extraLabelContent)
      : renderEfficiencyRow(label, isTotal, getter, indent, color, extraLabelContent);
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <TableHeader labelHeader={labelHeader} />
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }

  // ── Sections ─────────────────────────────────────────────────────────────────

  const channelRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    (REPORT_CHANNELS as readonly string[]).forEach(ch => {
      rows.push(renderRow(ch, false, (d, m) => sumByChannelMetric(d, ch, m)));
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode]);

  const brandRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    brands.forEach(brand => {
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
      ));
      if (isExpanded) {
        brand.models.forEach(model => {
          rows.push(renderRow(
            model, false,
            (d, m) => sumByModelMetric(d, brand.name, model, m),
            1,
          ));
        });
      }
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode, brands, expandedBrands]);

  const showroomRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    showroomItems.forEach(sr => {
      rows.push(renderRow(sr.name, false, (d, m) => totalAllChannels(d, m) * sr.weight));
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData, actData, cmpPlan, cmpAct, hasCompare, reportMode, showroomItems]);

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
      background: reportMode === mode ? 'var(--color-primary)' : '#fff',
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
        {reportMode === 'efficiency' && (
          <span style={{ fontSize: 'var(--fs-label)', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
            CPL = NS ÷ KHQT · CR1 = GDTD÷KHQT · CR2 = KHĐ÷GDTD
          </span>
        )}
        <div style={{ flex: 1 }} />
        <ExportButton onExport={handleExport} />
      </div>

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
