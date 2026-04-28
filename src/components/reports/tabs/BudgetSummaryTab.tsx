'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { DataGridContainer } from '@/components/reui/data-grid/data-grid';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS,
  sumByChannelMetric, sumByBrandMetric, sumByModelMetric,
  type MonthlyPayloads,
} from '@/lib/report-data';
import type { BrandWithModels } from '@/lib/brands-data';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type MetricOption = 'Ngân sách' | 'KHQT' | 'GDTD' | 'KHĐ' | 'CPL';
const METRICS: MetricOption[] = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ', 'CPL'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalAllChannels(payload: Record<string, number>, metric: string): number {
  return (REPORT_CHANNELS as readonly string[]).reduce(
    (s, c) => s + sumByChannelMetric(payload, c, metric), 0
  );
}

function calcPct(actual: number, plan: number): number | null {
  if (plan <= 0) return null;
  return Math.round((actual / plan) * 1000) / 10;
}

function fmtNum(v: number, isNS: boolean): string {
  if (v === 0) return '—';
  return formatNumber(isNS ? +(v.toFixed(1)) : Math.round(v));
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'var(--color-text-muted)';
  if (pct >= 100) return '#16a34a';
  if (pct >= 80)  return '#d97706';
  return '#dc2626';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 'var(--fs-table)',
  borderBottom: '1px solid var(--color-border)',
  borderRight: '1px solid var(--color-border)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
};
const LABEL_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 1,
  borderRight: '1px solid var(--color-border-dark)',
};
const TH_STYLE: React.CSSProperties = {
  ...CELL,
  fontWeight: 700,
  background: 'var(--color-table-header)',
  borderBottom: '2px solid var(--color-border-dark)',
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--fs-label)',
};

// ─── DataCell ─────────────────────────────────────────────────────────────────

function DataCell({ thVal, khVal, isCPL, isNS, isTotal }: {
  thVal: number; khVal: number; isCPL: boolean; isNS: boolean; isTotal?: boolean;
}) {
  const fw = isTotal ? 700 : thVal > 0 ? 600 : 400;
  if (isCPL) {
    return (
      <td style={CELL}>
        <div style={{ fontWeight: fw, color: thVal > 0 ? 'var(--color-text)' : 'var(--color-border-dark)', fontSize: 'var(--fs-table)' }}>
          {thVal > 0 ? formatNumber(+(thVal).toFixed(2)) : '—'}
        </div>
      </td>
    );
  }
  const pct = calcPct(thVal, khVal);
  const showPct = thVal > 0 && pct !== null;
  const hasSubRow = khVal > 0 || showPct;
  return (
    <td style={CELL}>
      <div style={{ fontWeight: fw, color: thVal > 0 ? 'var(--color-text)' : 'var(--color-border-dark)', fontSize: 'var(--fs-table)' }}>
        {fmtNum(thVal, isNS)}
      </div>
      {hasSubRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          {khVal > 0 && (
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>{fmtNum(khVal, isNS)}</span>
          )}
          {khVal > 0 && showPct && (
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-border-dark)' }}>·</span>
          )}
          {showPct && (
            <span style={{ fontSize: 'var(--fs-label)', color: pctColor(pct!), fontWeight: pct! < 80 ? 700 : 600 }}>{pct}%</span>
          )}
        </div>
      )}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BudgetSummaryTab({
  plansByMonth,
  actualsByMonth,
  brands,
  showroomItems,
  showroomPayloadsByMonth,
}: {
  plansByMonth: MonthlyPayloads;
  actualsByMonth: MonthlyPayloads;
  brands: BrandWithModels[];
  showroomItems: { name: string; weight: number }[];
  showroomPayloadsByMonth?: Record<string, { plan: MonthlyPayloads; actual: MonthlyPayloads }>;
}) {
  const [metric, setMetric]           = useState<MetricOption>('Ngân sách');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('report_expanded_brands');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const isCPL = metric === 'CPL';
  const isNS  = metric === 'Ngân sách';

  useEffect(() => {
    try {
      localStorage.setItem('report_expanded_brands', JSON.stringify(Array.from(expandedBrands)));
    } catch { /* ignore */ }
  }, [expandedBrands]);

  function toggleBrand(brand: string) {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  }

  // ── Get TH value for a row+month ────────────────────────────────────────────

  function getThVal(
    month: number,
    getter: (payload: Record<string, number>, m: string) => number
  ): number {
    const payload = actualsByMonth[month] ?? {};
    if (isCPL) {
      const ns   = getter(payload, 'Ngân sách');
      const khqt = getter(payload, 'KHQT');
      return khqt > 0 ? +(ns / khqt).toFixed(2) : 0;
    }
    return getter(payload, metric);
  }

  function getKhVal(
    month: number,
    getter: (payload: Record<string, number>, m: string) => number
  ): number {
    if (isCPL) return 0;
    return getter(plansByMonth[month] ?? {}, metric);
  }

  function getYearTH(getter: (p: Record<string, number>, m: string) => number): number {
    if (isCPL) return 0;
    return ALL_MONTHS.reduce((s, m) => s + getter(actualsByMonth[m] ?? {}, metric), 0);
  }

  function getYearKH(getter: (p: Record<string, number>, m: string) => number): number {
    if (isCPL) return 0;
    return ALL_MONTHS.reduce((s, m) => s + getter(plansByMonth[m] ?? {}, metric), 0);
  }

  // ── Render one table row ────────────────────────────────────────────────────

  function renderRow(
    label: string,
    isTotal: boolean,
    getter: (payload: Record<string, number>, m: string) => number,
    indent = 0,
    color?: string | null,
    extraLabelContent?: React.ReactNode,
    rowVariant?: 'brand' | 'model',
  ) {
    const isBrand = rowVariant === 'brand';
    const isModel = rowVariant === 'model';
    const bg = isTotal ? 'var(--color-table-header)' : isBrand ? 'var(--color-surface-hover)' : isModel ? 'var(--color-surface)' : 'var(--color-cell-bg)';
    const borderTop = isTotal ? '2px solid var(--color-border-dark)' : isBrand ? '1px solid var(--color-border)' : undefined;
    const thTotal = getYearTH(getter);
    const khTotal = getYearKH(getter);
    const pctTotal = isCPL ? null : calcPct(thTotal, khTotal);
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
        {ALL_MONTHS.map(m => (
          <DataCell
            key={m}
            thVal={getThVal(m, getter)}
            khVal={getKhVal(m, getter)}
            isCPL={isCPL}
            isNS={isNS}
            isTotal={isTotal}
          />
        ))}
        {/* Year total */}
        <td style={{ ...CELL, fontWeight: 700, color: 'var(--color-primary)' }}>
          {isCPL ? '—' : (
            <>
              <div style={{ fontSize: 'var(--fs-table)' }}>{fmtNum(thTotal, isNS)}</div>
              {khTotal > 0 && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>{fmtNum(khTotal, isNS)}</div>}
              {thTotal > 0 && pctTotal !== null && (
                <div style={{ fontSize: 'var(--fs-label)', color: pctColor(pctTotal), fontWeight: 600 }}>{pctTotal}%</div>
              )}
            </>
          )}
        </td>
      </tr>
    );
  }

  // ── Section wrapper ──────────────────────────────────────────────────────────

  function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 4, height: 18, background: 'var(--color-primary)', borderRadius: 2 }} />
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--color-text)' }}>{title}</span>
        </div>
        <DataGridContainer>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-table-header)' }}>
                <th style={{ ...TH_STYLE, textAlign: 'left', minWidth: 160, position: 'sticky', left: 0, zIndex: 2 }}>
                  {title.replace('Theo ', '')}
                </th>
                {ALL_MONTHS.map(m => (
                  <th key={m} style={{ ...TH_STYLE, minWidth: 72 }}>T{m}</th>
                ))}
                <th style={{ ...TH_STYLE, minWidth: 90, color: 'var(--color-primary)' }}>Cả năm</th>
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
          </div>
        </DataGridContainer>
      </div>
    );
  }

  // ── Channel rows ─────────────────────────────────────────────────────────────

  const channelRows = useMemo(() => (
    <>
      {(REPORT_CHANNELS as readonly string[]).map(ch =>
        renderRow(ch, false, (p, m) => sumByChannelMetric(p, ch, m))
      )}
      {renderRow('Tổng cộng', true, totalAllChannels)}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [plansByMonth, actualsByMonth, metric]);

  // ── Brand rows ───────────────────────────────────────────────────────────────

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
      rows.push(renderRow(brand.name, false, (p, m) => sumByBrandMetric(p, brand.name, m), 0, brand.color, expandIcon, isExpanded ? 'brand' : undefined));
      if (isExpanded) {
        brand.models.forEach(model => {
          rows.push(renderRow(model, false, (p, m) => sumByModelMetric(p, brand.name, model, m), 1, null, undefined, 'model'));
        });
      }
    });
    rows.push(renderRow('Tổng cộng', true, totalAllChannels));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansByMonth, actualsByMonth, metric, brands, expandedBrands]);

  // ── Showroom rows ────────────────────────────────────────────────────────────

  const showroomRows = useMemo(() => (
    <>
      {showroomItems.map(sr => {
        const srPayloads = showroomPayloadsByMonth?.[sr.name];
        const getter = (p: Record<string, number>, m: string): number => {
          if (!srPayloads) return 0;
          // Identify month by reference equality — getThVal/getKhVal pass plansByMonth[month] or actualsByMonth[month] directly
          for (const month of ALL_MONTHS) {
            if (Object.is(p, actualsByMonth[month])) return totalAllChannels(srPayloads.actual[month] ?? {}, m);
            if (Object.is(p, plansByMonth[month]))   return totalAllChannels(srPayloads.plan[month]   ?? {}, m);
          }
          return 0;
        };
        return renderRow(sr.name, false, getter);
      })}
      {renderRow('Tổng cộng', true, totalAllChannels)}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [plansByMonth, actualsByMonth, metric, showroomItems, showroomPayloadsByMonth]);

  // ── Export ───────────────────────────────────────────────────────────────────

  function handleExport() {
    const makeRows = (
      labels: string[],
      getterFn: (label: string) => (p: Record<string, number>, m: string) => number,
    ) => labels.map(label => {
      const g = getterFn(label);
      const r: Record<string, string | number> = { Nhóm: label };
      ALL_MONTHS.forEach(mon => {
        r[`T${mon}_TH`] = isCPL ? 0 : g(actualsByMonth[mon] ?? {}, metric);
        r[`T${mon}_KH`] = isCPL ? 0 : g(plansByMonth[mon] ?? {}, metric);
      });
      return r;
    });
    exportToExcel([
      { name: 'Kenh', rows: makeRows(
        [...(REPORT_CHANNELS as readonly string[]), 'Tổng'],
        label => label === 'Tổng' ? (p, m) => totalAllChannels(p, m) : (p, m) => sumByChannelMetric(p, label, m)
      )},
      { name: 'ThuongHieu', rows: makeRows(
        [...brands.map(b => b.name), 'Tổng'],
        label => label === 'Tổng' ? (p, m) => totalAllChannels(p, m) : (p, m) => sumByBrandMetric(p, label, m)
      )},
    ], `Xu_huong_12_thang_${metric}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {METRICS.map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '4px 10px', border: 'none', cursor: 'pointer',
              fontSize: 'var(--fs-body)',
              background: metric === m ? 'var(--color-primary)' : 'var(--color-cell-bg)',
              color: metric === m ? '#fff' : 'var(--color-text-muted)',
              fontWeight: metric === m ? 700 : 400,
            }}>{m}</button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)' }}>
          {isCPL ? 'CPL = Ngân sách ÷ KHQT (tr/lead) — không có KH' : 'Mỗi ô: TH / KH / %TH'}
        </span>
        <div style={{ flex: 1 }} />
        <ExportButton onExport={handleExport} />
      </div>

      <TableSection title="Theo kênh Marketing">{channelRows}</TableSection>
      <TableSection title="Theo thương hiệu">{brandRows}</TableSection>
      <TableSection title="Theo Showroom">{showroomRows}</TableSection>
    </div>
  );
}
