'use client';
import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS, computeChannelKPIs, getMonthsForPeriod, mergePayloads,
  type MonthlyPayloads,
} from '@/lib/report-data';

export function ChannelEfficiencyTab({
  plansByMonth,
  actualsByMonth,
  viewMode,
  month,
}: {
  plansByMonth: MonthlyPayloads;
  actualsByMonth: MonthlyPayloads;
  viewMode: 'month' | 'quarter' | 'year';
  month: number;
}) {
  const months = useMemo(() => getMonthsForPeriod(viewMode, month), [viewMode, month]);
  const actualMerged = useMemo(() => mergePayloads(actualsByMonth, months), [actualsByMonth, months]);
  const planMerged   = useMemo(() => mergePayloads(plansByMonth, months), [plansByMonth, months]);

  const kpis = useMemo(() =>
    REPORT_CHANNELS.map((ch) => {
      const actual = computeChannelKPIs(actualMerged, ch);
      const plan   = computeChannelKPIs(planMerged, ch);
      const useActual = actual.ns > 0;
      return { channel: ch, ...(useActual ? actual : plan), isActual: useActual };
    }),
  [actualMerged, planMerged]);

  function cplColor(cpl: number | null): string {
    if (!cpl) return 'var(--color-text-muted)';
    if (cpl < 0.1) return '#16a34a';
    if (cpl < 0.2) return '#d97706';
    return '#dc2626';
  }

  function crColor(cr: number | null): string {
    if (!cr) return 'var(--color-text-muted)';
    if (cr >= 20) return '#16a34a';
    if (cr >= 10) return '#d97706';
    return '#dc2626';
  }

  const HEADER: React.CSSProperties = {
    padding: '6px 10px', fontWeight: 700, fontSize: 'var(--fs-label)',
    background: '#f8fafc', borderBottom: '1px solid var(--color-border)', textAlign: 'right',
  };
  const CELL: React.CSSProperties = {
    padding: '7px 10px', fontSize: 'var(--fs-table)',
    borderBottom: '1px solid var(--color-border-light)', textAlign: 'right', whiteSpace: 'nowrap',
  };

  function handleExport() {
    const rows = kpis.map(({ channel, ns, khqt, cpl, gdtd, cr1, khd, cr2, isActual }) => ({
      'Kênh': channel,
      'Nguồn': isActual ? 'Thực hiện' : 'Kế hoạch',
      'NS (tr)': ns, 'KHQT': khqt, 'CPL (tr)': cpl ?? '',
      'GDTD': gdtd, 'CR1 (%)': cr1 ?? '', 'KHĐ': khd, 'CR2 (%)': cr2 ?? '',
    }));
    exportToExcel([{ name: 'Hieu_qua_kenh', rows }], 'Bao_cao_hieu_qua_kenh');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14, gap: 8 }}>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
          * Ưu tiên dùng số Thực hiện; nếu chưa có dùng Kế hoạch
        </span>
        <ExportButton onExport={handleExport} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...HEADER, textAlign: 'left', minWidth: 110 }}>Kênh</th>
            <th style={{ ...HEADER, minWidth: 80 }}>NS (tr)</th>
            <th style={{ ...HEADER, minWidth: 70 }}>KHQT</th>
            <th style={{ ...HEADER, minWidth: 70, color: '#2563eb' }}>CPL (tr)</th>
            <th style={{ ...HEADER, minWidth: 70 }}>GDTD</th>
            <th style={{ ...HEADER, minWidth: 70, color: '#2563eb' }}>CR1 %</th>
            <th style={{ ...HEADER, minWidth: 70 }}>KHĐ</th>
            <th style={{ ...HEADER, minWidth: 70, color: '#2563eb' }}>CR2 %</th>
            <th style={{ ...HEADER, textAlign: 'left', minWidth: 80 }}>Nguồn</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map(({ channel, ns, khqt, cpl, gdtd, cr1, khd, cr2, isActual }) => (
            <tr key={channel}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <td style={{ ...CELL, textAlign: 'left', fontWeight: 600, color: 'var(--color-text)' }}>{channel}</td>
              <td style={{ ...CELL }}>{ns > 0 ? formatNumber(+ns.toFixed(1)) : '—'}</td>
              <td style={{ ...CELL }}>{khqt > 0 ? formatNumber(Math.round(khqt)) : '—'}</td>
              <td style={{ ...CELL, fontWeight: 700, color: cplColor(cpl) }}>{cpl !== null ? formatNumber(+cpl.toFixed(3)) : '—'}</td>
              <td style={{ ...CELL }}>{gdtd > 0 ? formatNumber(Math.round(gdtd)) : '—'}</td>
              <td style={{ ...CELL, fontWeight: 700, color: crColor(cr1) }}>{cr1 !== null ? `${cr1}%` : '—'}</td>
              <td style={{ ...CELL }}>{khd > 0 ? formatNumber(Math.round(khd)) : '—'}</td>
              <td style={{ ...CELL, fontWeight: 700, color: crColor(cr2) }}>{cr2 !== null ? `${cr2}%` : '—'}</td>
              <td style={{ ...CELL, textAlign: 'left' }}>
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 2, fontWeight: 600,
                  background: isActual ? '#dcfce7' : '#f1f5f9',
                  color: isActual ? '#16a34a' : '#64748b',
                }}>
                  {isActual ? 'TH' : 'KH'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
