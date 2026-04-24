'use client';
import React, { useMemo, useState } from 'react';
import { formatNumber, cn } from '@/lib/utils';
import { ExportButton } from '../ExportButton';
import { exportToExcel } from '@/lib/report-export';
import {
  REPORT_CHANNELS, computeChannelKPIs, getMonthsForPeriod, mergePayloads,
  type MonthlyPayloads,
} from '@/lib/report-data';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid';
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table';
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header';

type KpiRow = {
  channel: string;
  ns: number; khqt: number; gdtd: number; khd: number;
  cpl: number | null; cr1: number | null; cr2: number | null;
  isActual: boolean;
};

const col = createColumnHelper<KpiRow>();

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

const RIGHT = 'text-right';

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
  const months       = useMemo(() => getMonthsForPeriod(viewMode, month), [viewMode, month]);
  const actualMerged = useMemo(() => mergePayloads(actualsByMonth, months), [actualsByMonth, months]);
  const planMerged   = useMemo(() => mergePayloads(plansByMonth, months),   [plansByMonth, months]);

  const kpis = useMemo<KpiRow[]>(() =>
    REPORT_CHANNELS.map((ch) => {
      const actual = computeChannelKPIs(actualMerged, ch);
      const plan   = computeChannelKPIs(planMerged, ch);
      const useActual = actual.ns > 0;
      return { channel: ch, ...(useActual ? actual : plan), isActual: useActual };
    }),
  [actualMerged, planMerged]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'ns', desc: true }]);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo(() => [
    col.accessor('channel', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="Kênh" />,
      cell: ({ getValue }) => <span className="font-semibold">{getValue() as string}</span>,
      size: 120,
      meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
    }),
    col.accessor('ns', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="NS (tr)" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className={cn(RIGHT, 'block', v > 0 ? 'font-semibold' : 'text-muted-foreground/40')}>{v > 0 ? formatNumber(+v.toFixed(1)) : '—'}</span>;
      },
      size: 85,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('khqt', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="KHQT" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className={cn(RIGHT, 'block', v > 0 ? '' : 'text-muted-foreground/40')}>{v > 0 ? formatNumber(Math.round(v)) : '—'}</span>;
      },
      size: 80,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('cpl', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="Chi phí / KHQT" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className={cn(RIGHT, 'block font-bold')} style={{ color: cplColor(v) }}>{v !== null ? `${formatNumber(+v.toFixed(2))} tr` : '—'}</span>;
      },
      size: 130,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('gdtd', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="GDTD" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className={cn(RIGHT, 'block', v > 0 ? '' : 'text-muted-foreground/40')}>{v > 0 ? formatNumber(Math.round(v)) : '—'}</span>;
      },
      size: 80,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('cr1', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="GDTD / KHQT" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className={cn(RIGHT, 'block font-semibold')} style={{ color: crColor(v) }}>{v !== null ? `${v}%` : '—'}</span>;
      },
      size: 120,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('khd', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="KHĐ" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className={cn(RIGHT, 'block font-bold', v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/40')}>{v > 0 ? formatNumber(Math.round(v)) : '—'}</span>;
      },
      size: 80,
      meta: { cellClassName: RIGHT },
    }),
    col.accessor('cr2', {
      header: ({ column }) => <DataGridColumnHeader column={column} title="KHĐ / GDTD" className={RIGHT} />,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className={cn(RIGHT, 'block font-semibold')} style={{ color: crColor(v) }}>{v !== null ? `${v}%` : '—'}</span>;
      },
      size: 120,
      meta: { cellClassName: RIGHT },
    }),
    col.display({
      id: 'source',
      header: () => <span className="text-xs font-semibold text-muted-foreground">Nguồn</span>,
      cell: ({ row }) => {
        const isActual = row.original.isActual;
        return (
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-semibold',
            isActual
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          )}>
            {isActual ? 'TH' : 'KH'}
          </span>
        );
      },
      size: 60,
      meta: { cellClassName: 'text-left' },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const table = useReactTable({
    data: kpis,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    const rows = table.getSortedRowModel().rows.map(r => {
      const { channel, ns, khqt, cpl, gdtd, cr1, khd, cr2, isActual } = r.original;
      return {
        'Kênh': channel,
        'Nguồn': isActual ? 'Thực hiện' : 'Kế hoạch',
        'NS (tr)': ns,
        'KHQT': khqt,
        'Chi phí/KHQT (tr)': cpl ?? '',
        'GDTD': gdtd,
        'Tỷ lệ GDTD/KHQT (%)': cr1 ?? '',
        'KHĐ': khd,
        'Tỷ lệ KHĐ/GDTD (%)': cr2 ?? '',
      };
    });
    exportToExcel([{ name: 'Hieu_qua_kenh', rows }], 'Bao_cao_hieu_qua_kenh');
  }

  const allEmpty = kpis.every(k => k.ns === 0 && k.khqt === 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded">
          Ưu tiên số Thực hiện · Chưa có dùng Kế hoạch · Bấm tiêu đề để sắp xếp
        </span>
        <ExportButton onExport={handleExport} />
      </div>

      {allEmpty ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Chưa có dữ liệu kênh cho kỳ này
        </div>
      ) : (
        <DataGrid
          table={table}
          recordCount={kpis.length}
          tableLayout={{
            stripped: true,
            rowBorder: true,
            cellBorder: false,
            headerBackground: true,
            headerSticky: false,
            dense: true,
            width: 'fixed',
          }}
          tableClassNames={{ base: 'text-sm' }}
        >
          <DataGridContainer border={true}>
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
      )}
    </div>
  );
}
