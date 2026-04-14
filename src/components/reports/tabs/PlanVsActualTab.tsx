'use client';
import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS, REPORT_METRICS,
  sumByChannelMetric, getMonthsForPeriod,
  mergePayloads,
  type MonthlyPayloads, type ReportMetric,
} from '@/lib/report-data';

function pctColor(pct: number | null): string {
  if (pct === null) return 'var(--color-text-muted)';
  if (pct >= 100) return '#16a34a';
  if (pct >= 80) return '#d97706';
  return '#dc2626';
}

export function PlanVsActualTab({
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
  const planData = useMemo(() => mergePayloads(plansByMonth, months), [plansByMonth, months]);
  const actualData = useMemo(() => mergePayloads(actualsByMonth, months), [actualsByMonth, months]);

  const HEADER_STYLE: React.CSSProperties = {
    padding: '6px 10px', fontWeight: 700, fontSize: 'var(--fs-label)',
    color: 'var(--color-text)', background: '#f8fafc',
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'right',
  };
  const CELL: React.CSSProperties = {
    padding: '5px 10px', fontSize: 'var(--fs-table)',
    borderBottom: '1px solid var(--color-border-light)',
    textAlign: 'right', whiteSpace: 'nowrap',
  };

  const rows: Array<{ channel: string; metric: ReportMetric; plan: number; actual: number }> = [];
  for (const ch of REPORT_CHANNELS) {
    for (const m of REPORT_METRICS) {
      rows.push({
        channel: ch, metric: m,
        plan:   sumByChannelMetric(planData, ch, m),
        actual: sumByChannelMetric(actualData, ch, m),
      });
    }
  }

  function handleExport() {
    const exportRows = rows.map(({ channel, metric, plan, actual }) => {
      const delta = actual - plan;
      const pct = plan > 0 ? +(actual / plan * 100).toFixed(1) : null;
      return {
        'Kênh': channel, 'Chỉ tiêu': metric,
        'Kế hoạch': plan, 'Thực hiện': actual,
        'Chênh lệch': delta, '% đạt': pct ?? '',
      };
    });
    exportToExcel([{ name: 'KH_vs_TH', rows: exportRows }], 'Bao_cao_KH_vs_TH');
  }

  let lastChannel = '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <ExportButton onExport={handleExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...HEADER_STYLE, textAlign: 'left', minWidth: 110, position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>Kênh</th>
              <th style={{ ...HEADER_STYLE, textAlign: 'left', minWidth: 80 }}>Chỉ tiêu</th>
              <th style={{ ...HEADER_STYLE, minWidth: 90 }}>Kế hoạch</th>
              <th style={{ ...HEADER_STYLE, minWidth: 90 }}>Thực hiện</th>
              <th style={{ ...HEADER_STYLE, minWidth: 90 }}>Chênh lệch</th>
              <th style={{ ...HEADER_STYLE, minWidth: 70 }}>% đạt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ channel, metric, plan, actual }) => {
              const isNewChannel = channel !== lastChannel;
              if (isNewChannel) lastChannel = channel;
              const delta = actual - plan;
              const pct = plan > 0 ? +(actual / plan * 100) : null;
              const isNS = metric === 'Ngân sách';

              return (
                <tr key={`${channel}-${metric}`}
                  style={{ background: isNewChannel ? '#fafbfc' : '#fff' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f0f4f8'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = isNewChannel ? '#fafbfc' : '#fff'}
                >
                  <td style={{ ...CELL, textAlign: 'left', fontWeight: isNewChannel ? 700 : 400, color: 'var(--color-text)', position: 'sticky', left: 0, background: 'inherit' }}>
                    {isNewChannel ? channel : ''}
                  </td>
                  <td style={{ ...CELL, textAlign: 'left', color: 'var(--color-text-muted)' }}>{metric}</td>
                  <td style={{ ...CELL }}>{plan > 0 ? formatNumber(isNS ? +plan.toFixed(1) : Math.round(plan)) : '—'}</td>
                  <td style={{ ...CELL, fontWeight: actual > 0 ? 600 : 400 }}>{actual > 0 ? formatNumber(isNS ? +actual.toFixed(1) : Math.round(actual)) : '—'}</td>
                  <td style={{ ...CELL, color: delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : 'var(--color-text-muted)' }}>
                    {plan > 0 || actual > 0 ? (delta >= 0 ? '+' : '') + formatNumber(isNS ? +delta.toFixed(1) : Math.round(delta)) : '—'}
                  </td>
                  <td style={{ ...CELL, fontWeight: 600, color: pctColor(pct) }}>
                    {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
