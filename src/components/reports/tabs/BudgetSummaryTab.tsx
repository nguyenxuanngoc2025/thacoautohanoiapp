'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS, REPORT_METRICS,
  sumByChannelMetric, extractShowrooms,
  type MonthlyPayloads, type ReportMetric,
} from '@/lib/report-data';

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const CHANNEL_COLORS: Record<string, string> = {
  Facebook: '#1877F2', Google: '#EA4335', Khác: '#64748B',
  CSKH: '#F59E0B', 'Nhận diện': '#8B5CF6', 'Sự kiện': '#10B981',
};

export function BudgetSummaryTab({ plansByMonth }: { plansByMonth: MonthlyPayloads }) {
  const [metric, setMetric] = useState<ReportMetric>('Ngân sách');
  const [pivotMode, setPivotMode] = useState<'channel' | 'showroom'>('channel');

  const showrooms = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const p of Object.values(plansByMonth)) {
      for (const [k, v] of Object.entries(p)) merged[k] = (merged[k] ?? 0) + v;
    }
    return extractShowrooms(merged);
  }, [plansByMonth]);

  const rowKeys = pivotMode === 'channel' ? [...REPORT_CHANNELS] : showrooms;

  function getCellValue(rowKey: string, month: number): number {
    const p = plansByMonth[month] ?? {};
    if (pivotMode === 'channel') {
      return sumByChannelMetric(p, rowKey, metric);
    } else {
      return REPORT_CHANNELS.reduce((acc, ch) => acc + sumByChannelMetric(p, ch, metric, rowKey), 0);
    }
  }

  function getRowTotal(rowKey: string): number {
    return ALL_MONTHS.reduce((acc, m) => acc + getCellValue(rowKey, m), 0);
  }

  function getColTotal(month: number): number {
    return rowKeys.reduce((acc, k) => acc + getCellValue(k, month), 0);
  }

  const grandTotal = rowKeys.reduce((acc, k) => acc + getRowTotal(k), 0);
  const unit = metric === 'Ngân sách' ? '(tr đ)' : '';

  function handleExport() {
    const rows = rowKeys.map((k) => {
      const row: Record<string, string | number> = { 'Kênh/Showroom': k };
      ALL_MONTHS.forEach(m => { row[`T${m}`] = getCellValue(k, m); });
      row['Tổng'] = getRowTotal(k);
      return row;
    });
    const totalRow: Record<string, string | number> = { 'Kênh/Showroom': 'TỔNG' };
    ALL_MONTHS.forEach(m => { totalRow[`T${m}`] = getColTotal(m); });
    totalRow['Tổng'] = grandTotal;
    rows.push(totalRow);
    exportToExcel([{ name: 'Tong_hop_NS', rows }], `Bao_cao_TH_NS_${metric}`);
  }

  const CELL: React.CSSProperties = {
    padding: '6px 10px', textAlign: 'right',
    fontSize: 'var(--fs-table)', borderBottom: '1px solid var(--color-border-light)',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {REPORT_METRICS.map((m) => (
            <button key={m} onClick={() => setMetric(m)}
              style={{
                padding: '4px 10px', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-body)',
                background: metric === m ? 'var(--color-primary)' : '#fff',
                color: metric === m ? '#fff' : 'var(--color-text-muted)',
                fontWeight: metric === m ? 700 : 400,
              }}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {(['channel', 'showroom'] as const).map((mode) => (
            <button key={mode} onClick={() => setPivotMode(mode)}
              style={{
                padding: '4px 10px', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-body)',
                background: pivotMode === mode ? '#334155' : '#fff',
                color: pivotMode === mode ? '#fff' : 'var(--color-text-muted)',
                fontWeight: pivotMode === mode ? 600 : 400,
              }}>
              {mode === 'channel' ? 'Theo kênh' : 'Theo showroom'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <ExportButton onExport={handleExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ ...CELL, textAlign: 'left', fontWeight: 700, minWidth: 130, color: 'var(--color-text)', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>
                {pivotMode === 'channel' ? 'Kênh' : 'Showroom'} {unit}
              </th>
              {ALL_MONTHS.map((m) => (
                <th key={m} style={{ ...CELL, fontWeight: 700, color: 'var(--color-text)', minWidth: 72 }}>T{m}</th>
              ))}
              <th style={{ ...CELL, fontWeight: 700, color: 'var(--color-primary)', minWidth: 80 }}>Tổng</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rowKey) => {
              const rowTotal = getRowTotal(rowKey);
              const color = pivotMode === 'channel' ? (CHANNEL_COLORS[rowKey] ?? 'var(--color-text)') : 'var(--color-text)';
              return (
                <tr key={rowKey}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <td style={{ ...CELL, textAlign: 'left', fontWeight: 600, color, position: 'sticky', left: 0, background: '#fff' }}>
                    {rowKey}
                  </td>
                  {ALL_MONTHS.map((m) => {
                    const val = getCellValue(rowKey, m);
                    return (
                      <td key={m} style={{ ...CELL, color: val > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {val > 0 ? formatNumber(metric === 'Ngân sách' ? val.toFixed(1) : Math.round(val)) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ ...CELL, fontWeight: 700, color: 'var(--color-primary)' }}>
                    {formatNumber(metric === 'Ngân sách' ? rowTotal.toFixed(1) : Math.round(rowTotal))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f4f8', fontWeight: 700 }}>
              <td style={{ ...CELL, textAlign: 'left', position: 'sticky', left: 0, background: '#f0f4f8' }}>TỔNG</td>
              {ALL_MONTHS.map((m) => (
                <td key={m} style={{ ...CELL, color: 'var(--color-text)' }}>
                  {formatNumber(metric === 'Ngân sách' ? getColTotal(m).toFixed(1) : Math.round(getColTotal(m)))}
                </td>
              ))}
              <td style={{ ...CELL, color: 'var(--color-primary)', fontSize: 13 }}>
                {formatNumber(metric === 'Ngân sách' ? grandTotal.toFixed(1) : Math.round(grandTotal))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
