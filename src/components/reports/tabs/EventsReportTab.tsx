'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import { type EventsByMonth, type EventItem, STATUS_CONFIG } from '@/lib/events-data';

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function EventsReportTab({
  eventsByMonth,
  filterMonth,
  filterShowroom,
}: {
  eventsByMonth: EventsByMonth;
  filterMonth: number;       // 0 = tất cả tháng
  filterShowroom: string;    // '' = tất cả showroom
}) {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const allEvents: EventItem[] = useMemo(() => {
    const months = filterMonth === 0 ? ALL_MONTHS : [filterMonth];
    return months.flatMap(m => eventsByMonth[m] ?? []);
  }, [eventsByMonth, filterMonth]);

  const filtered = useMemo(() => allEvents.filter(ev => {
    if (filterShowroom && ev.showroom !== filterShowroom) return false;
    if (statusFilter && ev.status !== statusFilter) return false;
    return true;
  }), [allEvents, filterShowroom, statusFilter]);

  const totalPlan   = filtered.reduce((s, ev) => s + (ev.budget ?? 0), 0);
  const totalActual = filtered.reduce((s, ev) => s + (ev.budgetSpent ?? 0), 0);
  const totalLeadsP = filtered.reduce((s, ev) => s + (ev.leads ?? 0), 0);
  const totalLeadsA = filtered.reduce((s, ev) => s + (ev.leadsActual ?? 0), 0);

  const STATUSES = Object.keys(STATUS_CONFIG);

  const HEADER: React.CSSProperties = {
    padding: '6px 10px', fontWeight: 700, fontSize: 'var(--fs-label)',
    background: 'var(--color-table-header)', borderBottom: '1px solid var(--color-border)', textAlign: 'left',
    whiteSpace: 'nowrap',
  };
  const CELL: React.CSSProperties = {
    padding: '7px 10px', fontSize: 'var(--fs-table)',
    borderBottom: '1px solid var(--color-border-light)', whiteSpace: 'nowrap',
  };

  function handleExport() {
    const rows = filtered.map((ev) => ({
      'Sự kiện': ev.name,
      'Showroom': ev.showroom,
      'Ngày': ev.date,
      'Thương hiệu': ev.brands?.join(', ') ?? '',
      'NS KH (tr)': ev.budget ?? 0,
      'NS TH (tr)': ev.budgetSpent ?? '',
      '± NS': (ev.budgetSpent ?? 0) - (ev.budget ?? 0),
      'Leads KH': ev.leads ?? '',
      'Leads TH': ev.leadsActual ?? '',
      'GDTD KH': ev.gdtd ?? '',
      'GDTD TH': ev.gdtdActual ?? '',
      'Trạng thái': ev.status as string,
    }));
    exportToExcel([{ name: 'Su_kien', rows }], 'Bao_cao_su_kien');
  }

  // Helper để lấy status label và colors từ STATUS_CONFIG (type-safe)
  function getStatusCfg(status: string): { label: string; color: string; bg: string } | null {
    const cfg = (STATUS_CONFIG as Record<string, { label: string; color: string; bg: string }>)[status];
    return cfg ?? null;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ height: 28, padding: '0 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-erp)', fontSize: 'var(--fs-body)', background: 'var(--color-surface-elevated)', color: 'var(--color-text)' }}
        >
          <option value="">— Tất cả trạng thái —</option>
          {STATUSES.map(s => {
            const cfg = getStatusCfg(s);
            return <option key={s} value={s}>{cfg?.label ?? s}</option>;
          })}
        </select>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
          {filtered.length} sự kiện
        </span>
        <div style={{ flex: 1 }} />
        <ExportButton onExport={handleExport} />
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '8px 12px', background: 'var(--color-table-header)', borderRadius: 'var(--border-radius-erp)', border: '1px solid var(--color-border)' }}>
        {[
          { label: 'NS kế hoạch', value: formatNumber(+totalPlan.toFixed(1)) + ' tr' },
          { label: 'NS thực hiện', value: formatNumber(+totalActual.toFixed(1)) + ' tr' },
          { label: '± NS', value: (totalActual - totalPlan >= 0 ? '+' : '') + formatNumber(+(totalActual - totalPlan).toFixed(1)) + ' tr', color: totalActual <= totalPlan ? '#16a34a' : '#dc2626' },
          { label: 'Leads KH', value: formatNumber(totalLeadsP) },
          { label: 'Leads TH', value: formatNumber(totalLeadsA) },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--color-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...HEADER, minWidth: 160 }}>Sự kiện</th>
              <th style={{ ...HEADER, minWidth: 110 }}>Showroom</th>
              <th style={{ ...HEADER, minWidth: 80 }}>Ngày</th>
              <th style={{ ...HEADER, minWidth: 80 }}>Thương hiệu</th>
              <th style={{ ...HEADER, textAlign: 'right', minWidth: 70 }}>NS KH</th>
              <th style={{ ...HEADER, textAlign: 'right', minWidth: 70 }}>NS TH</th>
              <th style={{ ...HEADER, textAlign: 'right', minWidth: 60 }}>±</th>
              <th style={{ ...HEADER, textAlign: 'right', minWidth: 60 }}>Leads KH</th>
              <th style={{ ...HEADER, textAlign: 'right', minWidth: 60 }}>Leads TH</th>
              <th style={{ ...HEADER, minWidth: 90 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ ...CELL, textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Không có sự kiện nào</td></tr>
            ) : filtered.map((ev) => {
              const delta = (ev.budgetSpent ?? 0) - (ev.budget ?? 0);
              const cfg = getStatusCfg(ev.status ?? '');
              return (
                <tr key={ev.id}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <td style={{ ...CELL, fontWeight: 600 }}>{ev.name}</td>
                  <td style={{ ...CELL, color: 'var(--color-text-secondary)' }}>{ev.showroom}</td>
                  <td style={{ ...CELL, color: 'var(--color-text-muted)' }}>{ev.date}</td>
                  <td style={{ ...CELL, color: 'var(--color-text-muted)' }}>{ev.brands?.join(', ')}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{ev.budget ? formatNumber(+ev.budget.toFixed(1)) : '—'}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: ev.budgetSpent ? 600 : 400 }}>{ev.budgetSpent ? formatNumber(+ev.budgetSpent.toFixed(1)) : '—'}</td>
                  <td style={{ ...CELL, textAlign: 'right', color: delta <= 0 ? '#16a34a' : '#dc2626' }}>
                    {ev.budgetSpent ? (delta >= 0 ? '+' : '') + formatNumber(+delta.toFixed(1)) : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{ev.leads ?? '—'}</td>
                  <td style={{ ...CELL, textAlign: 'right', fontWeight: ev.leadsActual ? 600 : 400 }}>{ev.leadsActual ?? '—'}</td>
                  <td style={{ ...CELL }}>
                    {cfg && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    )}
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
