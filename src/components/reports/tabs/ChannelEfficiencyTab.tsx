'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS, computeChannelKPIs, getMonthsForPeriod, mergePayloads,
  type MonthlyPayloads,
} from '@/lib/report-data';

type KpiRow = {
  channel: string;
  ns: number; khqt: number; gdtd: number; khd: number;
  cpl: number | null; cr1: number | null; cr2: number | null;
  isActual: boolean;
};

type SortKey = 'channel' | 'ns' | 'khqt' | 'cpl' | 'gdtd' | 'cr1' | 'khd' | 'cr2';

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
  const months      = useMemo(() => getMonthsForPeriod(viewMode, month), [viewMode, month]);
  const actualMerged = useMemo(() => mergePayloads(actualsByMonth, months), [actualsByMonth, months]);
  const planMerged   = useMemo(() => mergePayloads(plansByMonth, months), [plansByMonth, months]);

  const kpis = useMemo<KpiRow[]>(() =>
    REPORT_CHANNELS.map((ch) => {
      const actual = computeChannelKPIs(actualMerged, ch);
      const plan   = computeChannelKPIs(planMerged, ch);
      const useActual = actual.ns > 0;
      return { channel: ch, ...(useActual ? actual : plan), isActual: useActual };
    }),
  [actualMerged, planMerged]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<SortKey>('ns');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const sortedKpis = useMemo(() => {
    return [...kpis].sort((a, b) => {
      if (sortCol === 'channel') {
        return sortDir === 'asc'
          ? a.channel.localeCompare(b.channel)
          : b.channel.localeCompare(a.channel);
      }
      const av = (a[sortCol] ?? 0) as number;
      const bv = (b[sortCol] ?? 0) as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [kpis, sortCol, sortDir]);

  // ── Color helpers ────────────────────────────────────────────────────────────
  function cplColor(cpl: number | null): string {
    if (!cpl) return 'var(--color-text-muted)';
    if (cpl < 0.15) return '#16a34a';
    if (cpl < 0.35) return '#d97706';
    return '#dc2626';
  }
  function crColor(cr: number | null): string {
    if (!cr) return 'var(--color-text-muted)';
    if (cr >= 20) return '#16a34a';
    if (cr >= 10) return '#d97706';
    return '#dc2626';
  }

  // ── Sortable header cell ─────────────────────────────────────────────────────
  function SortTh({
    col, children, align = 'right', minWidth = 72,
  }: { col: SortKey; children: React.ReactNode; align?: 'left' | 'right' | 'center'; minWidth?: number }) {
    const active = sortCol === col;
    const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
    return (
      <th
        onClick={() => handleSort(col)}
        title="Bấm để sắp xếp"
        style={{
          padding: '8px 10px',
          fontWeight: 600,
          fontSize: 'var(--fs-label)',
          background: active ? '#eff6ff' : '#f8fafc',
          borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
          color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          textAlign: align,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          minWidth,
        }}
      >
        {children}
        <span style={{ opacity: active ? 1 : 0.35, marginLeft: 2 }}>{arrow}</span>
      </th>
    );
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function handleExport() {
    const rows = sortedKpis.map(({ channel, ns, khqt, cpl, gdtd, cr1, khd, cr2, isActual }) => ({
      'Kênh': channel,
      'Nguồn': isActual ? 'Thực hiện' : 'Kế hoạch',
      'NS (tr)': ns,
      'KHQT': khqt,
      'Chi phí/KHQT (tr)': cpl ?? '',
      'GDTD': gdtd,
      'Tỷ lệ GDTD/KHQT (%)': cr1 ?? '',
      'KHĐ': khd,
      'Tỷ lệ KHĐ/GDTD (%)': cr2 ?? '',
    }));
    exportToExcel([{ name: 'Hieu_qua_kenh', rows }], 'Bao_cao_hieu_qua_kenh');
  }

  const CELL: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 'var(--fs-table)',
    borderBottom: '1px solid var(--color-border-light)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };

  const allEmpty = kpis.every(k => k.ns === 0 && k.khqt === 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', background: '#f1f5f9', padding: '3px 10px', borderRadius: 4 }}>
          Ưu tiên số Thực hiện · Chưa có dùng Kế hoạch · Bấm tiêu đề để sắp xếp
        </span>
        <ExportButton onExport={handleExport} />
      </div>

      {allEmpty ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
          Chưa có dữ liệu kênh cho kỳ này
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortTh col="channel" align="left" minWidth={110}>Kênh</SortTh>
                <SortTh col="ns">NS (tr)</SortTh>
                <SortTh col="khqt">KHQT</SortTh>
                <SortTh col="cpl" minWidth={120}>Chi phí / KHQT</SortTh>
                <SortTh col="gdtd">GDTD</SortTh>
                <SortTh col="cr1" minWidth={130}>Tỷ lệ GDTD / KHQT</SortTh>
                <SortTh col="khd">KHĐ</SortTh>
                <SortTh col="cr2" minWidth={120}>Tỷ lệ KHĐ / GDTD</SortTh>
                <th style={{
                  padding: '8px 10px', fontWeight: 600, fontSize: 'var(--fs-label)',
                  background: '#f8fafc', borderBottom: '2px solid var(--color-border)',
                  color: 'var(--color-text-secondary)', textAlign: 'left', minWidth: 60,
                }}>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {sortedKpis.map(({ channel, ns, khqt, cpl, gdtd, cr1, khd, cr2, isActual }, idx) => (
                <tr
                  key={channel}
                  style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}
                >
                  <td style={{ ...CELL, textAlign: 'left', fontWeight: 600, color: 'var(--color-text)', paddingLeft: 12 }}>
                    {channel}
                  </td>
                  <td style={{ ...CELL, fontWeight: ns > 0 ? 600 : 400, color: ns > 0 ? 'var(--color-text)' : '#cbd5e1' }}>
                    {ns > 0 ? formatNumber(+ns.toFixed(1)) : '—'}
                  </td>
                  <td style={{ ...CELL, color: khqt > 0 ? 'var(--color-text)' : '#cbd5e1' }}>
                    {khqt > 0 ? formatNumber(Math.round(khqt)) : '—'}
                  </td>
                  <td style={{ ...CELL, fontWeight: cpl ? 700 : 400, color: cplColor(cpl) }}>
                    {cpl !== null ? `${formatNumber(+cpl.toFixed(2))} tr` : '—'}
                  </td>
                  <td style={{ ...CELL, color: gdtd > 0 ? 'var(--color-text)' : '#cbd5e1' }}>
                    {gdtd > 0 ? formatNumber(Math.round(gdtd)) : '—'}
                  </td>
                  <td style={{ ...CELL, fontWeight: cr1 ? 600 : 400, color: crColor(cr1) }}>
                    {cr1 !== null ? `${cr1}%` : '—'}
                  </td>
                  <td style={{ ...CELL, fontWeight: khd > 0 ? 700 : 400, color: khd > 0 ? '#059669' : '#cbd5e1' }}>
                    {khd > 0 ? formatNumber(Math.round(khd)) : '—'}
                  </td>
                  <td style={{ ...CELL, fontWeight: cr2 ? 600 : 400, color: crColor(cr2) }}>
                    {cr2 !== null ? `${cr2}%` : '—'}
                  </td>
                  <td style={{ ...CELL, textAlign: 'left' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
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
      )}
    </div>
  );
}
