'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as xlsx from 'xlsx';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import { inferEventStatus } from '@/lib/events-data';
import { useEventsData } from '@/lib/use-data';
import { useFilteredBudget } from '@/lib/use-filtered-budget';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';
import { useBrands } from '@/contexts/BrandsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChannels } from '@/contexts/ChannelsContext';
import {
  Users, UserCheck, FileSignature, TrendingDown,
  AlertTriangle, CheckCircle, ChevronUp, ChevronDown,
  CalendarDays, CornerDownRight, DownloadCloud
} from 'lucide-react';

// Recharts (via shadcn chart)
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, Area, AreaChart,
  ResponsiveContainer, ComposedChart, Line
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { FilterDropdown } from '@/components/erp/FilterDropdown';
import { KpiCard, SparkLine } from '@/components/erp/KpiCard';
import { FunnelChart3D } from '@/components/erp/FunnelChart3D';
import { EmptyDataState } from '@/components/erp/EmptyDataState';

// REUI Data Grid
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid';
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table';
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header';

const CHANNELS = ['Google', 'Facebook', 'Khác', 'CSKH', 'Nhận diện'];

// ── Column Types ──────────────────────────────────────────────────────────────
type ShowroomRow = { name: string; plan: number; actual: number; khqt: number; gdtd: number; khd: number };
const col = createColumnHelper<ShowroomRow>();


// ── Parse event date ──────────────────────────────────────────────────────────
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const isChannelMatch = (key: string, filterChannel: string | null): boolean => {
  if (!filterChannel) return true;
  if (filterChannel === 'Tổng Digital') {
    return key.includes('-Google-') || key.includes('-Facebook-') || key.includes('-Khác-');
  }
  const chSearchName = filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel;
  return key.includes(`-${chSearchName}-`);
};


// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardReuiPage() {
  const { showrooms } = useShowrooms();
  const { activeUnitId } = useUnit();
  const { brands } = useBrands();
  const { profile, effectiveRole } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [viewMode, setViewMode] = useState<'month'|'quarter'|'year'>('month');
  const [month, setMonth] = useState(4);
  const [sorting, setSorting] = useState<SortingState>([]);

  // ── Filters State ─────────────────────────────────────────────────────────
  const [filterShowroom, setFilterShowroom] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string | null>(null);

  // ── Role-based Scope ──────────────────────────────────────────────────────
  const isRestrictedRole = ['mkt_showroom', 'gd_showroom'].includes(effectiveRole as string);
  const allowedShowroomName = isRestrictedRole ? (profile?.showroom?.name ?? null) : null;

  // mkt_brand: chỉ thấy showroom có brand được giao
  const visibleShowrooms = useMemo(() => {
    if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      return showrooms.filter(s => s.brands.some(b => profile.brands!.includes(b)));
    }
    return showrooms;
  }, [effectiveRole, profile, showrooms]);

  const isCompanyLevel = visibleShowrooms.length > 1;

  const unitIdForViews = activeUnitId === 'all' ? null : activeUnitId;

  // ── Events (chỉ dùng cho upcoming timeline) ───────────────────────────────
  const { data: eventsRaw } = useEventsData(activeUnitId);
  const eventsData = useMemo<any[]>(() =>
    eventsRaw ? Object.values(eventsRaw).flat() : [],
  [eventsRaw]);

  // ── Period ────────────────────────────────────────────────────────────────
  const monthsInView = useMemo(() => {
    if (viewMode === 'month') return [month];
    if (viewMode === 'quarter') { const q0 = (Math.ceil(month / 3) - 1) * 3 + 1; return [q0, q0 + 1, q0 + 2]; }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [viewMode, month]);

  // ── Chuẩn hóa filter — 1 hook xử lý tất cả ───────────────────────────────
  const {
    showroomBreakdown, brandBreakdown, channelBreakdown,
    barChartData, totals, planKpis, sparkData, isLoading,
  } = useFilteredBudget({
    unitId: unitIdForViews, year, monthsInView, activeMonth: month,
    filterShowroom, filterBrand, filterChannel,
  });

  const { totalPlan, totalActual, totalKhqt, totalGdtd, totalKhd, cpl, budgetPct } = totals;
  const { pBudget, pKhqt, pGdtd, pKhd } = planKpis;

  // ── Mounted ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && eventsRaw !== undefined) setMounted(true);
  }, [isLoading, eventsRaw]);

// ── Sortable Header ────────────────────────────────────────────────────────
const SortableHeader = ({ column, title, align = 'left' }: { column: any, title: string, align?: 'left'|'right'|'center' }) => {
  return (
    <div 
      onClick={column.getToggleSortingHandler()}
      style={{ 
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
      }}
    >
      {title}
      {{
        asc: <ChevronUp size={12} style={{ opacity: 0.8 }} />,
        desc: <ChevronDown size={12} style={{ opacity: 0.8 }} />,
      }[column.getIsSorted() as string] ?? <span style={{ width: 12 }} />}
    </div>
  );
};

  // mkt_brand: lọc bảng SR theo showroom được phép
  const visibleShowroomBreakdown = useMemo(() => {
    if (effectiveRole === 'mkt_brand' && visibleShowrooms.length < showrooms.length) {
      const allowed = new Set(visibleShowrooms.map(s => s.name));
      return showroomBreakdown.filter(r => allowed.has(r.name));
    }
    return showroomBreakdown;
  }, [showroomBreakdown, effectiveRole, visibleShowrooms, showrooms]);

  // ── REUI Table Columns (Showroom) ───────────────────────────────
  const showroomColumns = useMemo(() => {
    const totalPlan   = visibleShowroomBreakdown.reduce((s, r) => s + r.plan, 0);
    const totalActual = visibleShowroomBreakdown.reduce((s, r) => s + r.actual, 0);
    const totalKhqt   = visibleShowroomBreakdown.reduce((s, r) => s + r.khqt, 0);
    const totalGdtd   = visibleShowroomBreakdown.reduce((s, r) => s + r.gdtd, 0);
    const totalKhd    = visibleShowroomBreakdown.reduce((s, r) => s + r.khd, 0);
    const cpl         = totalKhqt > 0 ? (totalActual / totalKhqt) : 0;
    const budgetPct   = totalPlan > 0 ? (totalActual / totalPlan * 100) : 0;

    return [
      col.accessor('name', {
        header: ({ column }) => <SortableHeader column={column} title="Showroom" />,
        cell: info => <span style={{ fontWeight: 500 }}>{info.getValue()}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>TỔNG CỘNG</span>,
        meta: { headerClassName: 'text-left', cellClassName: 'text-left', footerClassName: 'text-left' } as any,
      }),
      col.accessor('plan', {
        header: ({ column }) => <SortableHeader column={column} title="KH (tr)" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-muted)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalPlan))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('actual', {
        header: ({ column }) => <SortableHeader column={column} title="TH (tr)" align="center" />,
        cell: info => {
          const row = info.row.original;
          const pct = row.plan > 0 ? (row.actual / row.plan * 100) : 0;
          return <span style={{ fontWeight: 500, color: pct > 100 ? '#92400e' : 'var(--color-text)' }}>{formatNumber(Math.round(info.getValue()))}</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalActual))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor(row => row.plan > 0 ? (row.actual / row.plan * 100) : 0, {
        id: 'pct', 
        header: ({ column }) => <SortableHeader column={column} title="%Chi" align="center" />,
        cell: info => {
          const v = info.getValue();
          const clr = v > 100 ? 'var(--color-danger)' : v > 80 ? 'var(--color-warning)' : 'var(--color-success)';
          return <span style={{ fontWeight: 600, color: clr }}>{v.toFixed(0)}%</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{budgetPct.toFixed(0)}%</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('khqt', {
        header: ({ column }) => <SortableHeader column={column} title="KHQT" align="center" />,
        cell: info => formatNumber(Math.round(info.getValue())),
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhqt))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('gdtd', {
        header: ({ column }) => <SortableHeader column={column} title="GDTD" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalGdtd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('khd', {
        header: ({ column }) => <SortableHeader column={column} title="KHĐ" align="center" />,
        cell: info => <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor(row => row.khqt > 0 ? (row.actual / row.khqt) : 0, {
        id: 'cpl', 
        header: ({ column }) => <SortableHeader column={column} title="CPL (tr)" align="center" />,
        cell: info => info.getValue() > 0 ? info.getValue().toFixed(1) : '—',
        footer: () => <span style={{ fontWeight: 700 }}>{cpl > 0 ? cpl.toFixed(1) : '—'}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
    ];
  }, [visibleShowroomBreakdown]);

  const showroomTable = useReactTable({
    data: visibleShowroomBreakdown,
    columns: showroomColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ── REUI Table Columns (Brand) ───────────────────────────────
  const brandColumns = useMemo(() => {
    const totalPlan   = brandBreakdown.reduce((s, r) => s + r.plan, 0);
    const totalActual = brandBreakdown.reduce((s, r) => s + r.actual, 0);
    const totalKhqt   = brandBreakdown.reduce((s, r) => s + r.khqt, 0);
    const totalGdtd   = brandBreakdown.reduce((s, r) => s + r.gdtd, 0);
    const totalKhd    = brandBreakdown.reduce((s, r) => s + r.khd, 0);
    const cpl         = totalKhqt > 0 ? (totalActual / totalKhqt) : 0;
    const budgetPct   = totalPlan > 0 ? (totalActual / totalPlan * 100) : 0;

    return [
      col.accessor('name', {
        header: ({ column }) => <SortableHeader column={column} title="Thương hiệu" />,
        cell: info => <span style={{ fontWeight: 500 }}>{info.getValue()}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>TỔNG CỘNG</span>,
        meta: { headerClassName: 'text-left', cellClassName: 'text-left', footerClassName: 'text-left' } as any,
      }),
      col.accessor('plan', {
        header: ({ column }) => <SortableHeader column={column} title="KH (tr)" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-muted)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalPlan))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('actual', {
        header: ({ column }) => <SortableHeader column={column} title="TH (tr)" align="center" />,
        cell: info => {
          const row = info.row.original;
          const pct = row.plan > 0 ? (row.actual / row.plan * 100) : 0;
          return <span style={{ fontWeight: 500, color: pct > 100 ? '#92400e' : 'var(--color-text)' }}>{formatNumber(Math.round(info.getValue()))}</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalActual))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor(row => row.plan > 0 ? (row.actual / row.plan * 100) : 0, {
        id: 'pct', 
        header: ({ column }) => <SortableHeader column={column} title="%Chi" align="center" />,
        cell: info => {
          const v = info.getValue();
          const clr = v > 100 ? 'var(--color-danger)' : v > 80 ? 'var(--color-warning)' : 'var(--color-success)';
          return <span style={{ fontWeight: 600, color: clr }}>{v.toFixed(0)}%</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{budgetPct.toFixed(0)}%</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('khqt', {
        header: ({ column }) => <SortableHeader column={column} title="KHQT" align="center" />,
        cell: info => formatNumber(Math.round(info.getValue())),
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhqt))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('gdtd', {
        header: ({ column }) => <SortableHeader column={column} title="GDTD" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalGdtd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor('khd', {
        header: ({ column }) => <SortableHeader column={column} title="KHĐ" align="center" />,
        cell: info => <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
      col.accessor(row => row.khqt > 0 ? (row.actual / row.khqt) : 0, {
        id: 'cpl', 
        header: ({ column }) => <SortableHeader column={column} title="CPL (tr)" align="center" />,
        cell: info => info.getValue() > 0 ? info.getValue().toFixed(1) : '—',
        footer: () => <span style={{ fontWeight: 700 }}>{cpl > 0 ? cpl.toFixed(1) : '—'}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' } as any,
      }),
    ];
  }, [brandBreakdown]);

  const brandTable = useReactTable({
    data: brandBreakdown,
    columns: brandColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });


  const alertShowrooms = useMemo(() =>
    showroomBreakdown
      .filter(sr => sr.plan > 0 && (sr.actual / sr.plan) > 1)
      .sort((a, b) => (b.actual / b.plan) - (a.actual / a.plan))
      .slice(0, 3),
  [showroomBreakdown]);

  const upcomingEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return eventsData
      .map(e => {
        const _date = parseEventDate(e.date);
        const inferredStatus = inferEventStatus(e, today);
        const daysUntil = _date ? Math.ceil((_date.getTime() - today.getTime()) / 86400000) : 999;
        return { ...e, _date, inferredStatus, daysUntil };
      })
      .filter(e => {
        if (e.inferredStatus === 'completed' || !e._date) return false;
        if (e.daysUntil > 14) return false;
        if (isRestrictedRole && allowedShowroomName && e.showroom !== allowedShowroomName) return false;
        const evBrands = Array.isArray(e.brands) ? e.brands : [];
        if (filterShowroom.length > 0 && !filterShowroom.includes(e.showroom)) return false;
        if (filterBrand.length > 0 && !filterBrand.some(fb => evBrands.includes(fb))) return false;
        if (filterModel.length > 0 && !filterModel.some(fm => evBrands.includes(fm))) return false;
        return true;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsData, isRestrictedRole, allowedShowroomName, filterShowroom, filterBrand, filterModel]);

  if (!mounted) return null;

  const deltaColor = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return 'var(--color-text-muted)';
    const up = val >= plan;
    if (higherIsBad) return up ? 'var(--color-danger)' : 'var(--color-success)';
    return up ? 'var(--color-success)' : 'var(--color-danger)';
  };
  const deltaBg = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return 'var(--color-surface-hover)';
    const up = val >= plan;
    if (higherIsBad) return up ? 'var(--color-danger-bg)' : 'var(--color-success-bg)';
    return up ? 'var(--color-success-bg)' : 'var(--color-danger-bg)';
  };

  // ════════════════════════════════════════════════════════════════════════════
  //   R E N D E R
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: 8 }}>
      <PageHeader
        title="Tổng quan"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        filters={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isCompanyLevel && (
              <FilterDropdown
                isMulti
                value={filterShowroom}
                options={visibleShowrooms.map(s => ({ value: s.name, label: s.name }))}
                onChange={setFilterShowroom}
                width={130}
                placeholder="Tất cả Showroom"
              />
            )}
            <FilterDropdown
              isMulti
              value={filterBrand}
              options={(effectiveRole === 'mkt_brand' && profile?.brands?.length ? brands.filter(b => profile.brands!.includes(b.name)) : brands).map(b => ({ value: b.name, label: b.name }))}
              onChange={(v) => { setFilterBrand(v); setFilterModel([]); }}
              width={140}
              placeholder="Tất cả Thương hiệu"
            />
            {!isCompanyLevel && (
              <FilterDropdown
                isMulti
                value={filterModel}
                options={
                  filterBrand.length > 0
                    ? brands.filter(b => filterBrand.includes(b.name)).flatMap(b => b.models).map(m => ({ value: m, label: m }))
                    : brands.flatMap(b => b.models).filter((m, i, a) => a.indexOf(m) === i).map(m => ({ value: m, label: m }))
                }
                onChange={setFilterModel}
                width={140}
                placeholder="Tất cả Dòng xe"
              />
            )}
            <FilterDropdown
              value={filterChannel || 'all'}
              options={[{ value: 'all', label: 'Tất cả Kênh' }, { value: 'Tổng Digital', label: 'Tổng Digital' }, ...CHANNELS.concat(['Sự kiện']).map(c => ({ value: c, label: c }))]}
              onChange={(v: string) => setFilterChannel(v === 'all' ? null : v)}
              width={160}
              placeholder="Tất cả Kênh"
            />
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'auto' }}>

        {/* ── ROW 1: KPI Grid — same 2fr + 4×1fr ───────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: 8 }}>

          {/* Hero — Ngân sách (giữ y hệt bản gốc) */}
          <div style={{
            background: 'var(--color-primary)', borderRadius: 'var(--border-radius-md)',
            padding: '14px 16px', position: 'relative', overflow: 'hidden',
            border: '1px solid #003d82', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.03em' }}>
                Ngân sách thực hiện
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                background: budgetPct > 100 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                color: budgetPct > 100 ? '#fca5a5' : '#6ee7b7',
              }}>
                {budgetPct > 100 ? '↑' : '↓'} {Math.abs(budgetPct - 100).toFixed(0)}% vs KH
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {formatNumber(Math.round(totalActual))}
              <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>triệu đ</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              KH: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{formatNumber(Math.round(pBudget))} tr</strong>
              {totalActual > pBudget && (
                <span style={{ marginLeft: 6, color: '#fca5a5' }}>↑ vượt {formatNumber(Math.round(totalActual - pBudget))} tr</span>
              )}
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'rgba(255,255,255,0.75)', width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>0%</span>
              <span style={{ color: budgetPct > 100 ? '#fca5a5' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{budgetPct.toFixed(0)}% đạt</span>
              <span>KH</span>
            </div>
          </div>

          <KpiCard label="Khách hàng quan tâm" value={totalKhqt} plan={pKhqt}
            spark={sparkData.khqt} sparkColor="#3b82f6" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg} />
          <KpiCard label="Giao dịch theo dõi" value={totalGdtd} plan={pGdtd}
            spark={sparkData.gdtd} sparkColor="#f59e0b" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg} />
          <KpiCard label="Ký hợp đồng" value={totalKhd} plan={pKhd}
            spark={sparkData.khd} sparkColor="#10b981" higherIsBad={false}
            deltaColor={deltaColor} deltaBg={deltaBg} />
          {/* CPL */}
          {/* CPL */}
          <div className="panel" style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
            {/* Label: Top Center */}
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.02em', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Cost Per Lead
            </div>
            
            {/* Center Block: Number and CPA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {cpl > 0 ? cpl.toFixed(2) : <span style={{ color: 'var(--color-text-muted)' }}>— —</span>}
                {cpl > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 3 }}>tr/lead</span>}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                CPA: <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{totalKhd > 0 ? (totalActual / totalKhd).toFixed(1) : '—'} tr/sale</strong>
              </div>
            </div>
    
            {/* Bottom Block: Sparkline */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <SparkLine values={sparkData.budget.map((b, i) => sparkData.khqt[i] > 0 ? b / sparkData.khqt[i] : 0)} color="var(--color-primary)" />
            </div>
          </div>
        </div>

        {/* ── ROW 2: Showroom table (REUI) + Funnel + Donut/Events ─────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, gap: 8, minWidth: 0 }}>
          {/* ★ REUI DataGrid — Thay thế bảng tĩnh cũ bằng Stack (Showroom + Brand) ★ */}
          <div style={{ flex: '100 1 500px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {/* --- Bảng Thương hiệu --- */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="panel-header">
                <div className="panel-header-title">
                  <span className="panel-header-accent" />
                  Hiệu quả ngân sách theo Thương hiệu
                </div>
                <button
                  onClick={() => {
                    const showroomRows = showroomTable.getCoreRowModel().rows.map(r => r.original);
                    const brandRows = brandTable.getCoreRowModel().rows.map(r => r.original);
                    
                    if (showroomRows.length === 0 && brandRows.length === 0) return;
                    
                    const showroomData = [
                      ['Showroom', 'Ngân sách', 'Thực chi', 'KHQT', 'GDTD', 'KHD'],
                      ...showroomRows.map(r => [
                        r.name.includes('\\n') ? r.name.split('\\n')[1] : r.name,
                        r.plan,
                        r.actual,
                        r.khqt,
                        r.gdtd,
                        r.khd
                      ])
                    ];
                    
                    const brandData = [
                      ['Thương hiệu', 'Ngân sách', 'Thực chi', 'KHQT', 'GDTD', 'KHD'],
                      ...brandRows.map(r => [
                        r.name,
                        r.plan,
                        r.actual,
                        r.khqt,
                        r.gdtd,
                        r.khd
                      ])
                    ];

                    const wb = xlsx.utils.book_new();
                    const wsShowroom = xlsx.utils.aoa_to_sheet(showroomData);
                    xlsx.utils.book_append_sheet(wb, wsShowroom, "Theo Showroom");
                    
                    const wsBrand = xlsx.utils.aoa_to_sheet(brandData);
                    xlsx.utils.book_append_sheet(wb, wsBrand, "Theo Thương hiệu");
                    
                    xlsx.writeFile(wb, `THACO_MKT_Data_${month}_${year}.xlsx`);
                  }}
                  title="Xuất Excel"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 6,
                    background: 'var(--color-success)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600
                  }}
                >
                  <DownloadCloud size={14} /> Xuất Excel
                </button>
              </div>
              <div style={{ overflowX: 'auto', padding: '0 16px 16px 16px' }}>
                {brandBreakdown.length === 0 ? (
                  <div style={{ padding: '40px 0', width: '100%' }}><EmptyDataState message="Không có dữ liệu thương hiệu nào" /></div>
                ) : (
                  <DataGrid
                    table={brandTable}
                    recordCount={brandBreakdown.length}
                    tableLayout={{ stripped: true, cellBorder: false, rowBorder: true, headerSticky: true, dense: true, width: 'fixed', headerBackground: true }}
                    tableClassNames={{ base: 'data-table' }}
                  >
                    <DataGridContainer border={false}>
                      <DataGridTable
                        footerContent={brandTable.getFooterGroups().map(group => (
                          <tr key={group.id} style={{ background: 'var(--color-surface-elevated)', color: 'var(--color-primary)' }}>
                            {group.headers.map(header => (
                              <td key={header.id} className={(header.column.columnDef.meta as any)?.footerClassName as string || ''} style={{ borderTop: '2px solid var(--color-primary)', padding: '10px 8px', ...(header.getSize() !== 150 ? { width: header.getSize() } : {})}}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      />
                    </DataGridContainer>
                  </DataGrid>
                )}
              </div>
            </div>

            {/* --- Bảng Showroom --- */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="panel-header">
                <div className="panel-header-title">
                  <span className="panel-header-accent" />
                  Hiệu quả ngân sách theo Showroom
                </div>
              </div>
              <div style={{ overflowX: 'auto', padding: '0 16px 16px 16px' }}>
                {visibleShowroomBreakdown.length === 0 ? (
                  <div style={{ padding: '40px 0', width: '100%' }}><EmptyDataState message="Không có dữ liệu showroom nào" /></div>
                ) : (
                  <DataGrid
                    table={showroomTable}
                    recordCount={visibleShowroomBreakdown.length}
                    tableLayout={{ stripped: true, cellBorder: false, rowBorder: true, headerSticky: true, dense: true, width: 'fixed', headerBackground: true }}
                    tableClassNames={{ base: 'data-table' }}
                  >
                    <DataGridContainer border={false}>
                      <DataGridTable
                        footerContent={showroomTable.getFooterGroups().map(group => (
                          <tr key={group.id} style={{ background: 'var(--color-surface-elevated)', color: 'var(--color-primary)' }}>
                            {group.headers.map(header => (
                              <td key={header.id} className={(header.column.columnDef.meta as any)?.footerClassName as string || ''} style={{ borderTop: '2px solid var(--color-primary)', padding: '10px 8px', ...(header.getSize() !== 150 ? { width: header.getSize() } : {})}}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      />
                    </DataGridContainer>
                  </DataGrid>
                )}
              </div>
            </div>
          </div>

          {/* Funnel & Donut Column */}
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240, maxWidth: '100%' }}>
              <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="panel-header">
                  <div className="panel-header-title">
                    <span className="panel-header-accent" />
                    Phễu chuyển đổi
                  </div>
                </div>
                <FunnelChart3D
                  totalKhqt={totalKhqt || pKhqt}
                  totalGdtd={totalGdtd || pGdtd}
                  totalKhd={totalKhd || pKhd}
                  isFallback={!totalKhqt && !totalGdtd && !totalKhd}
                />
              </div>

              {/* ★ Donut — Recharts PieChart thay thế SVG vẽ tay ★ */}
              <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="panel-header">
                  <div className="panel-header-title">
                    <span className="panel-header-accent" />
                    Phân bổ Kênh
                  </div>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                  {channelBreakdown.length === 0 ? (
                    <div style={{ width: '100%', height: '100%' }}>
                      <EmptyDataState message="Chưa có thiết lập kênh phân phối" />
                    </div>
                  ) : (
                    <>
                      <div style={{ flexShrink: 0, width: 115, height: 115, contain: 'layout style paint' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={channelBreakdown} 
                              dataKey="amount" 
                              nameKey="name" 
                              cx="50%" cy="50%" innerRadius={30} outerRadius={52} strokeWidth={2} stroke="#fff"
                              onClick={(data) => {
                                if (data?.name) {
                                  setFilterChannel(prev => prev === data.name ? null : (data.name as string));
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {channelBreakdown.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-dropdown)' }}
                              formatter={(value: any, name: any) => [`${formatNumber(Math.round(value))} tr`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                        {channelBreakdown.map(ch => (
                          <div
                            key={ch.name}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                            onClick={() => setFilterChannel(prev => prev === ch.name ? null : ch.name)}
                          >
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: ch.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{ch.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          {/* Events Column */}
          <div className="panel" style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', minWidth: 240, maxWidth: '100%' }}>
              <div className="panel-header">
                <div className="panel-header-title">
                  <span className="panel-header-accent" />
                  Sự kiện sắp tới
                </div>
              </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' }}>
                  {upcomingEvents.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '6px 0' }}>Không có sự kiện sắp tới</div>
                  ) : upcomingEvents.map((ev, i) => {
                    const d = ev._date as Date;
                    const diff = ev.daysUntil;
                    const isOverdue = ev.inferredStatus === 'overdue' || diff < 0;
                    const isUrgent = diff >= 0 && diff <= 3;
                    const urgBg  = isOverdue ? 'var(--color-danger-bg)' : diff === 0 ? 'var(--color-primary-light)' : isUrgent ? 'var(--color-warning-bg)' : 'var(--color-surface-hover)';
                    const urgClr = isOverdue ? 'var(--color-danger)' : diff === 0 ? 'var(--color-primary)' : isUrgent ? 'var(--color-warning)' : 'var(--color-text-muted)';
                    const urgTxt = isOverdue ? `Trễ ${Math.abs(diff)}n` : diff === 0 ? 'Đang diễn ra' : diff === 1 ? 'Ngày mai' : `Còn ${diff}n`;
                    return (
                      <Link href={`/events?eventId=${ev.id}`} key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 4, background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', alignItems: 'center', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }} className="transition-colors"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-elevated)'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--color-primary)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                          <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8 }}>T{d.getMonth() + 1}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name || ev.eventName || 'Sự kiện'}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{ev.showroom || ''}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 10, background: urgBg, color: urgClr, flexShrink: 0 }}>{urgTxt}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
          </div>

        {/* ── ROW 3: ★ Recharts BarChart thay thế SVG vẽ tay ★ ──────── */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-title">
              <span className="panel-header-accent" />
              Ngân sách 12 tháng / {year}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 0, borderBottom: '2px dashed #f59e0b', display: 'inline-block' }} /> Kế hoạch
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} /> Thực hiện
              </span>
            </div>
          </div>
          <div style={{ padding: '8px 12px', height: 180, contain: 'layout style paint' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={barChartData} margin={{ top: 12, right: 4, left: -20, bottom: 0 }} barGap={0}>
                <defs>
                  <linearGradient id="modernBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border-light)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 500 }} dy={8} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => v === 0 ? '0' : `${(v / 1000).toFixed(1).replace('.0', '')} Tỷ`} />
                <RechartsTooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{
                          background: 'var(--color-surface-elevated)',
                          border: '1px solid var(--color-border)',
                          boxShadow: 'var(--shadow-dropdown)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          minWidth: 160
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 4 }}>Tháng {label?.replace('T', '')}</div>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color === 'url(#modernBarGradient)' ? 'var(--color-primary)' : entry.color }} />
                                {entry.dataKey === 'plan' ? 'Kế hoạch' : 'Thực hiện'}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(Math.round(entry.value))} tr</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ fill: 'rgba(0, 75, 155, 0.04)' }}
                />
                <Bar 
                  dataKey="actual" 
                  fill="url(#modernBarGradient)" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={32} 
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => {
                    if (data?.activePayload?.[0]?.payload?.name) {
                       const nameStr = data.activePayload[0].payload.name;
                       const mStr = nameStr.replace('T', '');
                       const m = parseInt(mStr);
                       if (!isNaN(m)) setMonth(m);
                    } else if (data?.name) {
                       const mStr = data.name.replace('T', '');
                       const m = parseInt(mStr);
                       if (!isNaN(m)) setMonth(m);
                    }
                  }}
                />

                {/* 2. Target Line (Kế hoạch) - Đường Line đứt đoạn (dashed) màu Cam (Amber) */}
                <Line
                  type="monotone"
                  dataKey="plan"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

