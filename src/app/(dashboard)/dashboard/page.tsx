'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as xlsx from 'xlsx';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import { fetchAllBudgetPlans } from '@/lib/budget-data';
import { fetchAllActualEntries } from '@/lib/actual-data';
import { fetchEventsFromDB } from '@/lib/events-data';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';
import { useBrands } from '@/contexts/BrandsContext';
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

const DONUT_COLORS = ['#3b82f6','#10b981','#f59e0b','#6366f1','#ec4899','#06b6d4'];
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



// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardReuiPage() {
  const { showrooms } = useShowrooms();
  const { activeUnitId } = useUnit();
  const { brands } = useBrands();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [viewMode, setViewMode] = useState<'month'|'quarter'|'year'>('month');
  const [month, setMonth] = useState(4);
  const [plansByMonth, setPlansByMonth] = useState<Record<number, Record<string, number>>>({});
  const [actualsByMonth, setActualsByMonth] = useState<Record<number, Record<string, number>>>({});
  const [eventsData, setEventsData] = useState<any[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // ── Filters State ─────────────────────────────────────────────────────────
  const [filterShowroom, setFilterShowroom] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string | null>(null);
  const isCompanyLevel = showrooms.length > 1;

  // ── Data fetching ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [budgetPlans, actuals, eventsObj] = await Promise.all([
      fetchAllBudgetPlans(activeUnitId),
      fetchAllActualEntries(year, activeUnitId),
      fetchEventsFromDB(activeUnitId),
    ]);
    const pm: Record<number, Record<string, number>> = {};
    const am: Record<number, Record<string, number>> = {};
    if (budgetPlans?.length) budgetPlans.forEach(p => { pm[p.month] = p.payload || {}; });
    if (actuals?.length) actuals.forEach(a => { am[a.month] = a.payload || {}; });
    setPlansByMonth(pm);
    setActualsByMonth(am);
    setEventsData(eventsObj ? Object.values(eventsObj).flat() : []);
  }, [year, activeUnitId]);

  useEffect(() => { loadData().then(() => setMounted(true)); }, [loadData]);

  // ── Derived data (identical logic to original dashboard) ──────────────────
  const monthsInView = useMemo(() => {
    if (viewMode === 'month') return [month];
    if (viewMode === 'quarter') { const q0 = (Math.ceil(month / 3) - 1) * 3 + 1; return [q0, q0 + 1, q0 + 2]; }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [viewMode, month]);

  const selectedWeight = useMemo(() => {
    if (!isCompanyLevel) return 1;
    if (filterShowroom.length > 0) {
       return filterShowroom.reduce((sum, name) => {
         const sr = showrooms.find(s => s.name === name);
         return sum + (sr ? sr.weight : 0);
       }, 0);
    }
    return 1;
  }, [isCompanyLevel, filterShowroom, showrooms]);

  const planData = useMemo(() => {
    const m2: Record<string, number> = {};
    monthsInView.forEach(m => { 
      Object.entries(plansByMonth[m] || {}).forEach(([k, v]) => { 
        let normalizedK = k;
        if (normalizedK.startsWith('Peugeot-')) {
          normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
        }
        if (filterBrand.length > 0) {
             const brandMatch = filterBrand.some(b => normalizedK.startsWith(`${b}-`));
             if (!brandMatch) return;
             if (filterModel.length > 0) {
                  const modelMatch = filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)));
                  if (!modelMatch) return;
             }
        }
        if (filterChannel) {
             const chSearchName = filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel;
             if (!normalizedK.includes(`-${chSearchName}-`)) return;
        }
        m2[normalizedK] = (m2[normalizedK] || 0) + (v * selectedWeight); 
      }); 
    });
    return m2;
  }, [plansByMonth, monthsInView, filterBrand, filterModel, filterChannel, selectedWeight]);

  const actualData = useMemo(() => {
    const m2: Record<string, number> = {};
    monthsInView.forEach(m => { 
      Object.entries(actualsByMonth[m] || {}).forEach(([k, v]) => { 
        let normalizedK = k;
        if (normalizedK.startsWith('Peugeot-')) {
          normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
        }
        if (filterBrand.length > 0) {
             const brandMatch = filterBrand.some(b => normalizedK.startsWith(`${b}-`));
             if (!brandMatch) return;
             if (filterModel.length > 0) {
                  const modelMatch = filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)));
                  if (!modelMatch) return;
             }
        }
        if (filterChannel) {
             const chSearchName = filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel;
             if (!normalizedK.includes(`-${chSearchName}-`)) return;
        }
        m2[normalizedK] = (m2[normalizedK] || 0) + (v * selectedWeight); 
      }); 
    });
    return m2;
  }, [actualsByMonth, monthsInView, filterBrand, filterModel, filterChannel, selectedWeight]);

  const eventsInView = useMemo(() => {
    return eventsData.filter(e => {
      if (!e.date) return false;
      let evY: number, evM: number;
      if (e.date.includes('/')) { const p = e.date.split('/'); evY = parseInt(p[2]); evM = parseInt(p[1]); }
      else { const p = e.date.split('-'); evY = parseInt(p[0]); evM = parseInt(p[1]); }
      if (isNaN(evY) || isNaN(evM) || evY !== year) return false;
      if (!monthsInView.includes(evM)) return false;

      // Extract brands from event and map Peugeot -> STELLANTIS
      const normalizedBrands = Array.isArray(e.brands) ? e.brands.map((b: string) => b === 'Peugeot' ? 'STELLANTIS' : b) : [];

      // Apply filters
      if (filterShowroom.length > 0 && !filterShowroom.includes(e.showroom)) return false;
      if (filterBrand.length > 0 && !filterBrand.some(fb => normalizedBrands.includes(fb))) return false;
      if (filterModel.length > 0 && !filterModel.some(fm => normalizedBrands.includes(fm))) return false;
      if (filterChannel && filterChannel !== 'Sự kiện') return false;
      return true;
    });
  }, [eventsData, year, monthsInView, filterShowroom, filterBrand, filterModel, filterChannel, showrooms]);

  const sumByMetric = useCallback((data: Record<string, number>, metric: string, excludeEvent = false) => {
    let total = 0;
    for (const [k, v] of Object.entries(data)) { if (k.endsWith(`-${metric}`)) { if (excludeEvent && k.includes('-Sự kiện-')) continue; total += v; } }
    return total;
  }, []);

  const sumByChannelValue = useCallback((data: Record<string, number>, chName: string) => {
    let total = 0;
    const name = chName === 'Khác (Digital)' ? 'Khác' : chName;
    for (const [k, v] of Object.entries(data)) { if (k.includes(`-${name}-`) && k.endsWith('-Ngân sách')) total += v; }
    return total;
  }, []);

  const showroomBreakdown = useMemo(() => {
    // planData and actualData already have selectedWeight applied.
    // To calculate the breakdown per individual showroom, we need the RAW company total.
    // So we divide out the selectedWeight (which is > 0) to get back to the raw 100% company value.
    const rawGP = sumByMetric(planData, 'Ngân sách', true) / (selectedWeight || 1);
    const rawGA = sumByMetric(actualData, 'Ngân sách', true) / (selectedWeight || 1);
    const rawGKhqtA = sumByMetric(actualData, 'KHQT', true) / (selectedWeight || 1);
    const rawGGdtdA = sumByMetric(actualData, 'GDTD', true) / (selectedWeight || 1);
    const rawGKhdA = sumByMetric(actualData, 'KHĐ', true) / (selectedWeight || 1);
    
    // Filter showrooms based on filterShowroom selection
    const filteredSR = filterShowroom.length === 0
      ? showrooms
      : showrooms.filter(s => filterShowroom.includes(s.name));
      
    return filteredSR.map(sr => {
      const w = sr.weight;
      const evs = eventsInView.filter(e => e.showroom === sr.name);
      return {
        name: sr.name,
        plan: (rawGP * w) + evs.reduce((s, e) => s + (e.budget || 0), 0),
        actual: (rawGA * w) + evs.reduce((s, e) => s + (e.budgetSpent || 0), 0),
        khqt: (rawGKhqtA * w) + evs.reduce((s, e) => s + (e.leadsActual || 0), 0),
        gdtd: (rawGGdtdA * w) + evs.reduce((s, e) => s + (e.gdtdActual || 0), 0),
        khd: (rawGKhdA * w) + evs.reduce((s, e) => s + (e.dealsActual || 0), 0),
      };
    });
  }, [planData, actualData, eventsInView, sumByMetric, showrooms, filterShowroom, selectedWeight]);

  const brandBreakdown = useMemo(() => {
    const filteredBrands = filterBrand.length === 0
      ? brands
      : brands.filter(b => filterBrand.includes(b.name));
      
    return filteredBrands.map(br => {
      let p = 0; let a = 0; let q = 0; let d = 0; let h = 0;

      for (const [k, v] of Object.entries(planData)) {
        if (k.startsWith(`${br.name}-`) && k.endsWith('-Ngân sách') && !k.includes('-Sự kiện-')) p += v;
      }
      for (const [k, v] of Object.entries(actualData)) {
        if (k.startsWith(`${br.name}-`)) {
          if (k.endsWith('-Ngân sách') && !k.includes('-Sự kiện-')) a += v;
          else if (k.endsWith('-KHQT') && !k.includes('-Sự kiện-')) q += v;
          else if (k.endsWith('-GDTD') && !k.includes('-Sự kiện-')) d += v;
          else if (k.endsWith('-KHĐ') && !k.includes('-Sự kiện-')) h += v;
        }
      }

      const evs = eventsInView.filter(e => {
        const normalizedBrands = Array.isArray(e.brands) ? e.brands.map((b: string) => b === 'Peugeot' ? 'STELLANTIS' : b) : [];
        return normalizedBrands.includes(br.name);
      });
      p += evs.reduce((s, e) => s + (e.budget || 0), 0);
      a += evs.reduce((s, e) => s + (e.budgetSpent || 0), 0);
      q += evs.reduce((s, e) => s + (e.leadsActual || 0), 0);
      d += evs.reduce((s, e) => s + (e.gdtdActual || 0), 0);
      h += evs.reduce((s, e) => s + (e.dealsActual || 0), 0);
      
      return {
        name: br.name, plan: p, actual: a, khqt: q, gdtd: d, khd: h
      };
    });
  }, [planData, actualData, eventsInView, brands, filterBrand]);

  const sparkData = useMemo(() => {
    const last5 = Array.from({ length: 5 }, (_, i) => { const m = month - 4 + i; return m < 1 ? m + 12 : m; });
    return {
      budget: last5.map(m => { 
        const d = actualsByMonth[m] || {}; 
        return Object.entries(d).filter(([k]) => {
          let normalizedK = k;
          if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
          if (!normalizedK.endsWith('-Ngân sách')) return false;
          if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
          if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
          if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
          return true;
        }).reduce((s, [, v]) => s + (v * selectedWeight), 0); 
      }),
      khqt: last5.map(m => { 
        const d = actualsByMonth[m] || {}; 
        return Object.entries(d).filter(([k]) => {
          let normalizedK = k;
          if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
          if (!normalizedK.endsWith('-KHQT')) return false;
          if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
          if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
          if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
          return true;
        }).reduce((s, [, v]) => s + (v * selectedWeight), 0); 
      }),
      gdtd: last5.map(m => { 
        const d = actualsByMonth[m] || {}; 
        return Object.entries(d).filter(([k]) => {
          let normalizedK = k;
          if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
          if (!normalizedK.endsWith('-GDTD')) return false;
          if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
          if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
          if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
          return true;
        }).reduce((s, [, v]) => s + (v * selectedWeight), 0); 
      }),
      khd: last5.map(m => { 
        const d = actualsByMonth[m] || {}; 
        return Object.entries(d).filter(([k]) => {
          let normalizedK = k;
          if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
          if (!normalizedK.endsWith('-KHĐ')) return false;
          if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
          if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
          if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
          return true;
        }).reduce((s, [, v]) => s + (v * selectedWeight), 0); 
      }),
    };
  }, [actualsByMonth, month, filterBrand, filterModel, filterChannel, selectedWeight]);

  const channelBreakdown = useMemo(() => {
    // Không dùng actualData đã bị filterChannel, tính lại từ raw actualsByMonth
    // để Pie Chart không bị co lại thành 1 múi 100% khi được select.
    const rawActualData: Record<string, number> = {};
    monthsInView.forEach(m => {
      Object.entries(actualsByMonth[m] || {}).forEach(([k, v]) => {
        let normalizedK = k;
        if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
        if (filterBrand.length > 0) {
             const brandMatch = filterBrand.some(b => normalizedK.startsWith(`${b}-`));
             if (!brandMatch) return;
             if (filterModel.length > 0) {
                  const modelMatch = filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)));
                  if (!modelMatch) return;
             }
        }
        rawActualData[normalizedK] = (rawActualData[normalizedK] || 0) + (v * selectedWeight);
      });
    });

    const list = CHANNELS.map(name => ({ name, amount: sumByChannelValue(rawActualData, name) }));
    
    // Tính số tiền Sự kiện từ raw eventsData, KHÔNG bị block bỡi filterChannel !== 'Sự kiện'
    const evsAmount = eventsData.filter(e => {
      if (!e.date) return false;
      let evY: number, evM: number;
      if (e.date.includes('/')) { const p = e.date.split('/'); evY = parseInt(p[2]); evM = parseInt(p[1]); }
      else { const p = e.date.split('-'); evY = parseInt(p[0]); evM = parseInt(p[1]); }
      if (isNaN(evY) || isNaN(evM) || evY !== year) return false;
      if (!monthsInView.includes(evM)) return false;
      const normalizedBrands = Array.isArray(e.brands) ? e.brands.map((b: string) => b === 'Peugeot' ? 'STELLANTIS' : b) : [];
      if (filterShowroom.length > 0 && !filterShowroom.includes(e.showroom)) return false;
      if (filterBrand.length > 0 && !filterBrand.some(fb => normalizedBrands.includes(fb))) return false;
      if (filterModel.length > 0 && !filterModel.some(fm => normalizedBrands.includes(fm))) return false;
      return true;
    }).reduce((s, e) => s + (e.budgetSpent || 0), 0);

    list.push({ name: 'Sự kiện', amount: evsAmount });
    
    const total = list.reduce((s, c) => s + c.amount, 0);
    return list.map((ch, i) => ({ ...ch, color: DONUT_COLORS[i % DONUT_COLORS.length], pct: total > 0 ? Math.round((ch.amount / total) * 100) : 0 })).sort((a, b) => b.amount - a.amount);
  }, [actualsByMonth, eventsData, monthsInView, year, filterBrand, filterModel, filterShowroom, selectedWeight, sumByChannelValue]);

  const barChartData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const planEntries = Object.entries(plansByMonth[m] || {}).filter(([k]) => {
      let normalizedK = k;
      if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
      if (!normalizedK.endsWith('-Ngân sách')) return false;
      if (normalizedK.includes('-Sự kiện-')) return false;
      if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
      if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
      if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
      return true;
    });
    const actualEntries = Object.entries(actualsByMonth[m] || {}).filter(([k]) => {
      let normalizedK = k;
      if (normalizedK.startsWith('Peugeot-')) normalizedK = normalizedK.replace('Peugeot-', 'STELLANTIS-');
      if (!normalizedK.endsWith('-Ngân sách')) return false;
      if (normalizedK.includes('-Sự kiện-')) return false;
      if (filterBrand.length > 0 && !filterBrand.some(b => normalizedK.startsWith(`${b}-`))) return false;
      if (filterModel.length > 0 && !filterBrand.some(b => filterModel.some(mod => normalizedK.startsWith(`${b}-${mod}-`)))) return false;
      if (filterChannel && !normalizedK.includes(`-${filterChannel === 'Khác (Digital)' ? 'Khác' : filterChannel}-`)) return false;
      return true;
    });

    const monthEvents = eventsData.filter(e => {
      if (!e.date) return false;
      let evY: number, evM: number;
      if (e.date.includes('/')) { const p = e.date.split('/'); evY = parseInt(p[2]); evM = parseInt(p[1]); }
      else { const p = e.date.split('-'); evY = parseInt(p[0]); evM = parseInt(p[1]); }
      if (isNaN(evY) || isNaN(evM) || evY !== year || evM !== m) return false;

      const normalizedBrands = Array.isArray(e.brands) ? e.brands.map((b: string) => b === 'Peugeot' ? 'STELLANTIS' : b) : [];

      if (filterShowroom.length > 0 && !filterShowroom.includes(e.showroom)) return false;
      if (filterBrand.length > 0 && !filterBrand.some(fb => normalizedBrands.includes(fb))) return false;
      if (filterModel.length > 0 && !filterModel.some(fm => normalizedBrands.includes(fm))) return false;
      if (filterChannel && filterChannel !== 'Sự kiện') return false;
      return true;
    });

    const eventsPlan = monthEvents.reduce((acc, e) => acc + (e.budget || 0), 0);
    const eventsActual = monthEvents.reduce((acc, e) => acc + (e.budgetSpent || 0), 0);

    const plan   = planEntries.reduce((s, [, v]) => s + v, 0) * selectedWeight + eventsPlan;
    const actual = actualEntries.reduce((s, [, v]) => s + v, 0) * selectedWeight + eventsActual;
    return { name: `T${m}`, plan: Math.round(plan), actual: Math.round(actual), isActive: m === month };
  }), [plansByMonth, actualsByMonth, month, filterShowroom, filterBrand, filterModel, filterChannel, selectedWeight, eventsData, year]);

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

  // ── REUI Table Columns (Showroom) ───────────────────────────────
  const showroomColumns = useMemo(() => {
    const totalPlan   = showroomBreakdown.reduce((s, r) => s + r.plan, 0);
    const totalActual = showroomBreakdown.reduce((s, r) => s + r.actual, 0);
    const totalKhqt   = showroomBreakdown.reduce((s, r) => s + r.khqt, 0);
    const totalGdtd   = showroomBreakdown.reduce((s, r) => s + r.gdtd, 0);
    const totalKhd    = showroomBreakdown.reduce((s, r) => s + r.khd, 0);
    const cpl         = totalKhqt > 0 ? (totalActual / totalKhqt) : 0;
    const budgetPct   = totalPlan > 0 ? (totalActual / totalPlan * 100) : 0;

    return [
      col.accessor('name', {
        header: ({ column }) => <SortableHeader column={column} title="Showroom" />,
        cell: info => <span style={{ fontWeight: 500 }}>{info.getValue()}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>TỔNG CỘNG</span>,
        meta: { headerClassName: 'text-left', cellClassName: 'text-left', footerClassName: 'text-left' },
      }),
      col.accessor('plan', {
        header: ({ column }) => <SortableHeader column={column} title="KH (tr)" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-muted)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalPlan))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('actual', {
        header: ({ column }) => <SortableHeader column={column} title="TH (tr)" align="center" />,
        cell: info => {
          const row = info.row.original;
          const pct = row.plan > 0 ? (row.actual / row.plan * 100) : 0;
          return <span style={{ fontWeight: 500, color: pct > 100 ? '#92400e' : 'var(--color-text)' }}>{formatNumber(Math.round(info.getValue()))}</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalActual))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
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
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('khqt', {
        header: ({ column }) => <SortableHeader column={column} title="KHQT" align="center" />,
        cell: info => formatNumber(Math.round(info.getValue())),
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhqt))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('gdtd', {
        header: ({ column }) => <SortableHeader column={column} title="GDTD" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalGdtd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('khd', {
        header: ({ column }) => <SortableHeader column={column} title="KHĐ" align="center" />,
        cell: info => <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor(row => row.khqt > 0 ? (row.actual / row.khqt) : 0, {
        id: 'cpl', 
        header: ({ column }) => <SortableHeader column={column} title="CPL (tr)" align="center" />,
        cell: info => info.getValue() > 0 ? info.getValue().toFixed(1) : '—',
        footer: () => <span style={{ fontWeight: 700 }}>{cpl > 0 ? cpl.toFixed(1) : '—'}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
    ];
  }, [showroomBreakdown]);

  const showroomTable = useReactTable({
    data: showroomBreakdown,
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
        meta: { headerClassName: 'text-left', cellClassName: 'text-left', footerClassName: 'text-left' },
      }),
      col.accessor('plan', {
        header: ({ column }) => <SortableHeader column={column} title="KH (tr)" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-muted)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalPlan))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('actual', {
        header: ({ column }) => <SortableHeader column={column} title="TH (tr)" align="center" />,
        cell: info => {
          const row = info.row.original;
          const pct = row.plan > 0 ? (row.actual / row.plan * 100) : 0;
          return <span style={{ fontWeight: 500, color: pct > 100 ? '#92400e' : 'var(--color-text)' }}>{formatNumber(Math.round(info.getValue()))}</span>;
        },
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalActual))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
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
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('khqt', {
        header: ({ column }) => <SortableHeader column={column} title="KHQT" align="center" />,
        cell: info => formatNumber(Math.round(info.getValue())),
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhqt))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('gdtd', {
        header: ({ column }) => <SortableHeader column={column} title="GDTD" align="center" />,
        cell: info => <span style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalGdtd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor('khd', {
        header: ({ column }) => <SortableHeader column={column} title="KHĐ" align="center" />,
        cell: info => <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(Math.round(info.getValue()))}</span>,
        footer: () => <span style={{ fontWeight: 700 }}>{formatNumber(Math.round(totalKhd))}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
      }),
      col.accessor(row => row.khqt > 0 ? (row.actual / row.khqt) : 0, {
        id: 'cpl', 
        header: ({ column }) => <SortableHeader column={column} title="CPL (tr)" align="center" />,
        cell: info => info.getValue() > 0 ? info.getValue().toFixed(1) : '—',
        footer: () => <span style={{ fontWeight: 700 }}>{cpl > 0 ? cpl.toFixed(1) : '—'}</span>,
        meta: { headerClassName: 'text-center', cellClassName: 'text-center', footerClassName: 'text-center' },
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

  if (!mounted) return null;

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalPlan   = showroomBreakdown.reduce((s, r) => s + r.plan, 0);
  const totalActual = showroomBreakdown.reduce((s, r) => s + r.actual, 0);
  const totalKhqt   = showroomBreakdown.reduce((s, r) => s + r.khqt, 0);
  const totalGdtd   = showroomBreakdown.reduce((s, r) => s + r.gdtd, 0);
  const totalKhd    = showroomBreakdown.reduce((s, r) => s + r.khd, 0);
  const cpl         = totalKhqt > 0 ? (totalActual / totalKhqt) : 0;
  const budgetPct   = totalPlan > 0 ? (totalActual / totalPlan * 100) : 0;
  const pKhqt = sumByMetric(planData, 'KHQT');
  const pGdtd = sumByMetric(planData, 'GDTD');
  const pKhd  = sumByMetric(planData, 'KHĐ');
  const pBudget = sumByMetric(planData, 'Ngân sách');

  const alertShowrooms = showroomBreakdown
    .filter(sr => sr.plan > 0 && (sr.actual / sr.plan) > 1)
    .sort((a, b) => (b.actual / b.plan) - (a.actual / a.plan))
    .slice(0, 3);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingEvents = eventsData
    .map(e => ({ ...e, _date: parseEventDate(e.date) }))
    .filter(e => {
      if (!e._date || e._date < today) return false;
      const normalizedBrands = Array.isArray(e.brands) ? e.brands.map((b: string) => b === 'Peugeot' ? 'STELLANTIS' : b) : [];
      if (filterShowroom.length > 0 && !filterShowroom.includes(e.showroom)) return false;
      if (filterBrand.length > 0 && !filterBrand.some(fb => normalizedBrands.includes(fb))) return false;
      if (filterModel.length > 0 && !filterModel.some(fm => normalizedBrands.includes(fm))) return false;
      return true;
    })
    .sort((a, b) => a._date!.getTime() - b._date!.getTime())
    .slice(0, 4);

  const deltaColor = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return 'var(--color-text-muted)';
    const up = val >= plan;
    if (higherIsBad) return up ? 'var(--color-danger)' : 'var(--color-success)';
    return up ? 'var(--color-success)' : 'var(--color-danger)';
  };
  const deltaBg = (val: number, plan: number, higherIsBad = false) => {
    if (plan === 0) return '#f1f5f9';
    const up = val >= plan;
    if (higherIsBad) return up ? '#fef2f2' : '#ecfdf5';
    return up ? '#ecfdf5' : '#fef2f2';
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
                options={showrooms.map(s => ({ value: s.name, label: s.name }))}
                onChange={setFilterShowroom}
                width={130}
                placeholder="Tất cả Showroom"
              />
            )}
            <FilterDropdown
              isMulti
              value={filterBrand}
              options={brands.map(b => ({ value: b.name, label: b.name }))}
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
            {/* --- Bảng Showroom --- */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
                  Hiệu quả ngân sách theo Showroom
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
                {showroomBreakdown.length === 0 ? (
                  <div style={{ padding: '40px 0', width: '100%' }}><EmptyDataState message="Không có dữ liệu showroom nào" /></div>
                ) : (
                  <DataGrid
                    table={showroomTable}
                    recordCount={showroomBreakdown.length}
                    tableLayout={{ stripped: true, cellBorder: false, rowBorder: true, headerSticky: true, dense: true, width: 'auto', headerBackground: true }}
                    tableClassNames={{ base: 'data-table' }}
                  >
                    <DataGridContainer border={false}>
                      <DataGridTable
                        footerContent={showroomTable.getFooterGroups().map(group => (
                          <tr key={group.id} style={{ background: '#e2e8f0', color: 'var(--color-primary)' }}>
                            {group.headers.map(header => (
                              <td key={header.id} className={header.column.columnDef.meta?.footerClassName as string || ''} style={{ borderTop: '2px solid var(--color-primary)', padding: '10px 8px', ...(header.getSize() !== 150 ? { width: header.getSize() } : {})}}>
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

            {/* --- Bảng Thương hiệu --- */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
                  Hiệu quả ngân sách theo Thương hiệu
                </div>
              </div>
              <div style={{ overflowX: 'auto', padding: '0 16px 16px 16px' }}>
                {brandBreakdown.length === 0 ? (
                  <div style={{ padding: '40px 0', width: '100%' }}><EmptyDataState message="Không có dữ liệu thương hiệu nào" /></div>
                ) : (
                  <DataGrid
                    table={brandTable}
                    recordCount={brandBreakdown.length}
                    tableLayout={{ stripped: true, cellBorder: false, rowBorder: true, headerSticky: true, dense: true, width: 'auto', headerBackground: true }}
                    tableClassNames={{ base: 'data-table' }}
                  >
                    <DataGridContainer border={false}>
                      <DataGridTable
                        footerContent={brandTable.getFooterGroups().map(group => (
                          <tr key={group.id} style={{ background: '#e2e8f0', color: 'var(--color-primary)' }}>
                            {group.headers.map(header => (
                              <td key={header.id} className={header.column.columnDef.meta?.footerClassName as string || ''} style={{ borderTop: '2px solid var(--color-primary)', padding: '10px 8px', ...(header.getSize() !== 150 ? { width: header.getSize() } : {})}}>
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
                <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
                    Phễu chuyển đổi
                  </div>
                </div>
                <FunnelChart3D totalKhqt={totalKhqt} totalGdtd={totalGdtd} totalKhd={totalKhd} />
              </div>

              {/* ★ Donut — Recharts PieChart thay thế SVG vẽ tay ★ */}
              <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
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
                      <div style={{ flexShrink: 0, width: 115, height: 115 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={channelBreakdown} 
                              dataKey="amount" 
                              nameKey="name" 
                              cx="50%" cy="50%" innerRadius={30} outerRadius={52} strokeWidth={2} stroke="#fff"
                              onClick={(data) => {
                                if (data?.name) {
                                  setFilterChannel(prev => prev === data.name ? null : data.name);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {channelBreakdown.map((entry, i) => (
                                <Cell 
                                  key={i} 
                                  fill={entry.color} 
                                  opacity={filterChannel && filterChannel !== entry.name ? 0.3 : 1}
                                />
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
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                              opacity: filterChannel && filterChannel !== ch.name ? 0.4 : 1
                            }}
                            onClick={() => setFilterChannel(prev => prev === ch.name ? null : ch.name)}
                          >
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: ch.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: filterChannel === ch.name ? 600 : 400 }}>{ch.name}</span>
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
              <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
                  Sự kiện sắp tới
                </div>
              </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' }}>
                  {upcomingEvents.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '6px 0' }}>Không có sự kiện sắp tới</div>
                  ) : upcomingEvents.map((ev, i) => {
                    const d = ev._date as Date;
                    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                    const urgBg  = diff <= 3 ? '#fef2f2' : diff <= 7 ? '#fffbeb' : '#eff6ff';
                    const urgClr = diff <= 3 ? '#991b1b' : diff <= 7 ? '#92400e' : '#1e40af';
                    const urgTxt = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff <= 3 ? `${diff} ngày` : `${diff}n`;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid var(--color-border)', alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--color-primary)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                          <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8 }}>T{d.getMonth() + 1}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name || ev.eventName || 'Sự kiện'}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{ev.showroom || ''}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 10, background: urgBg, color: urgClr, flexShrink: 0 }}>{urgTxt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>

        {/* ── ROW 3: ★ Recharts BarChart thay thế SVG vẽ tay ★ ──────── */}
        <div className="panel">
          <div style={{ padding: '12px 16px', background: '#e2e8f0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--color-primary)', borderRadius: 2 }} />
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
          <div style={{ padding: '8px 12px', height: 180 }}>
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
                          background: 'rgba(255, 255, 255, 0.75)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255, 255, 255, 0.6)',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
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

