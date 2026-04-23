'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import {
  CalendarCheck, MapPin, Users, Wallet, TrendingUp,
  CheckCircle2, BarChart3, Activity, Calendar, Flag, Eye,
  AlertTriangle, Plus, Pencil, FileCheck2, Trash2
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import dynamic from 'next/dynamic';
import {
  upsertEventToDB, deleteEventFromDB, inferEventStatus,
  EVENT_TYPE_COLORS, STATUS_CONFIG, PRIORITY_CONFIG,
  type EventItem, type EventsByMonth, type EventStatus, type EventPriority,
  emptyEvent
} from '@/lib/events-data';
import { useEventsData, invalidateEventsData } from '@/lib/use-data';

// Lazy load Modals để giảm kích thước bundle ban đầu
const EventFormModal = dynamic(() => import('@/components/events/EventFormModal'), { ssr: false });
const CloseReportModal = dynamic(() => import('@/components/events/CloseReportModal'), { ssr: false });
const EventResultModal = dynamic(() => import('@/components/events/EventResultModal'), { ssr: false });

// Helper: kiểm tra event đã qua ngày chưa
function isEventPast(event: EventItem): boolean {
  const dateStr = event.date;
  if (!dateStr) return false;
  let parts: string[];
  if (dateStr.includes('/')) parts = dateStr.split('/');
  else parts = dateStr.split('-').reverse();
  if (parts.length !== 3) return false;
  const [d, m, y] = parts.map(Number);
  const eventDate = new Date(y, m - 1, d);
  return eventDate < new Date();
}
import { KPICard, MiniBarChart, DonutChart, MonthlySparkline } from '@/components/events/EventDashboardCards';
import { FilterDropdown } from '@/components/erp/FilterDropdown';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useBrands } from '@/contexts/BrandsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';

// ─── Modal state types ─────────────────────────────────────────────────────────
type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; data: EventItem }
  | { mode: 'edit';   data: EventItem }
  | { mode: 'close_report'; data: EventItem };

// ─── Config ────────────────────────────────────────────────────────────────────
const UPCOMING_REMINDER_DAYS = 14; // Nhắc sự kiện trong vòng N ngày tới

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [resultModalEvent, setResultModalEvent] = useState<EventItem | null>(null);
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [filterShowroom, setFilterShowroom] = useState<string | null>(null);
  const [tableMode, setTableMode] = useState<'plan' | 'actual'>('plan');

  // ── Load & persist ────────────────────────────────────────────────────────
  const [eventsByMonth, setEventsByMonth] = useState<EventsByMonth>({});
  const { showrooms, showroomNames } = useShowrooms();
  const { profile, effectiveRole } = useAuth();
  const { brands: DEMO_BRANDS } = useBrands();
  const { activeUnitId } = useUnit();

  // ── Role-based Scope ──────────────────────────────────────────────────────
  const canEditEvents = !!effectiveRole && !['bld', 'finance'].includes(effectiveRole);
  const isRestrictedRole = ['mkt_showroom', 'gd_showroom'].includes(effectiveRole as string);
  // Dùng showroom_ids (Phase 1 bottom-up) hoặc fallback về showroom name
  const allowedShowroomCodes: string[] = isRestrictedRole
    ? (profile?.showroom_ids?.length ? profile.showroom_ids : (profile?.showroom?.code ? [profile.showroom.code] : []))
    : [];

  // mkt_brand: chỉ thấy showroom có brand được giao
  const visibleShowroomNames = useMemo(() => {
    if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      return showrooms
        .filter(s => s.brands.some(b => profile.brands!.includes(b)))
        .map(s => s.name);
    }
    return showroomNames;
  }, [effectiveRole, profile, showrooms, showroomNames]);

  // mkt_brand: chỉ thấy brand được giao trong bộ lọc sự kiện
  const visibleBrandOptions = useMemo(() => {
    const base = DEMO_BRANDS.filter(b => !/^DVPT/i.test(b.name));
    if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      return base.filter(b => profile.brands!.includes(b.name));
    }
    return base;
  }, [effectiveRole, profile, DEMO_BRANDS]);

  // ── Data fetching via SWR (cached — chuyển trang không fetch lại) ──────────
  const { data: eventsRaw, mutate: mutateEvents } = useEventsData();

  // Sync SWR data → local state (chạy khi SWR lần đầu trả về data hoặc refresh)
  useEffect(() => {
    if (eventsRaw !== undefined) {
      setEventsByMonth(eventsRaw);
      setMounted(true);
    }
  }, [eventsRaw]);

  // Handle URL param to auto-open event
  useEffect(() => {
    if (Object.keys(eventsByMonth).length === 0) return;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const eventIdStr = params.get('eventId');
      if (eventIdStr) {
        const targetId = parseInt(eventIdStr, 10);
        let foundEvent: EventItem | undefined;
        let foundMonth = month;
        
        for (const [mStr, eventsArr] of Object.entries(eventsByMonth)) {
          const ev = eventsArr.find(e => e.id === targetId);
          if (ev) {
            foundEvent = ev;
            foundMonth = parseInt(mStr, 10);
            break;
          }
        }
        
        if (foundEvent && modal.mode === 'closed') { // Avoid reopening infinitely
          setMonth(foundMonth);
          setViewMode('month');
          const action = params.get('action');
          setModal(action === 'report'
            ? { mode: 'close_report', data: foundEvent }
            : { mode: 'edit', data: foundEvent }
          );
          // Remove param to keep URL clean after opening
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [eventsByMonth, month, modal.mode]);

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const upsertEvent = useCallback(async (ev: EventItem, targetMonth: number) => {
    // Inject unit_id + đảm bảo showroom_code nhất quán
    const resolvedSR = showrooms.find(s => s.name === ev.showroom);
    const evWithUnit: EventItem = {
      ...ev,
      unit_id: ev.unit_id || (activeUnitId !== 'all' ? activeUnitId : undefined),
      showroom_code: ev.showroom_code || resolvedSR?.code || ev.showroom,
    };
    // upsertEventToDB throws on failure — let it bubble up to EventFormModal
    await upsertEventToDB(evWithUnit);
    // Optimistic update local state
    setEventsByMonth(prev => {
      const arr = [...(prev[targetMonth] || [])];
      const idx = arr.findIndex(e => e.id === ev.id);
      if (idx >= 0) arr[idx] = ev; else arr.push(ev);
      return { ...prev, [targetMonth]: arr };
    });
    // Cập nhật SWR cache để dashboard/reports cũng thấy data mới
    mutateEvents();
  }, [mutateEvents, activeUnitId, showrooms]);

  const handleDeleteEvent = useCallback(async (ev: EventItem, targetMonth: number) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sự kiện "${ev.name}" không?\nHành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      await deleteEventFromDB(ev.id, ev.showroom_code || ev.showroom, ev.date);
      setEventsByMonth(prev => {
        const arr = [...(prev[targetMonth] || [])].filter(e => e.id !== ev.id);
        return { ...prev, [targetMonth]: arr };
      });
      mutateEvents();
    } catch (err: any) {
      alert(`Lỗi khi xóa sự kiện: ${err.message}`);
    }
  }, [mutateEvents]);

  // ── Events for current view ───────────────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const events = useMemo<EventItem[]>(() => {
    let raw: EventItem[];
    if (viewMode === 'month')        raw = eventsByMonth[month] || [];
    else if (viewMode === 'quarter') { const q0 = (Math.ceil(month / 3) - 1) * 3 + 1; raw = [q0, q0+1, q0+2].flatMap(m => eventsByMonth[m] || []); }
    else                             raw = Array.from({ length: 12 }, (_, i) => eventsByMonth[i+1] || []).flat();
    
    // Role-based filtering — ưu tiên showroom_code (Phase 1), fallback showroom name
    if (isRestrictedRole && allowedShowroomCodes.length > 0) {
      // mkt_showroom / gd_showroom: chỉ thấy event của showroom mình
      raw = raw.filter(ev =>
        ev.showroom_code
          ? allowedShowroomCodes.includes(ev.showroom_code)
          : allowedShowroomCodes.some(code => {
              const sr = showrooms.find(s => s.code === code);
              return sr?.name === ev.showroom;
            })
      );
    } else if (effectiveRole === 'mkt_brand' && profile?.brands && profile.brands.length > 0) {
      // mkt_brand: chỉ thấy event có ít nhất 1 brand mình phụ trách
      raw = raw.filter(ev => ev.brands.some(b => profile.brands!.includes(b)));
    }
    
    // User-selected filters
    if (filterBrand) raw = raw.filter(ev => ev.brands.includes(filterBrand));
    if (filterShowroom) raw = raw.filter(ev => ev.showroom === filterShowroom || ev.showroom_code === filterShowroom);

    return raw.map(ev => ({ ...ev, status: inferEventStatus(ev, today) }));
  }, [eventsByMonth, month, viewMode, isRestrictedRole, allowedShowroomCodes, showrooms, effectiveRole, profile, filterBrand, filterShowroom]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalBudget     = events.reduce((s, e) => s + e.budget, 0);
    const totalSpent      = events.reduce((s, e) => s + (e.budgetSpent ?? 0), 0);
    // Hiện thị số thực tế cho event đã hoàn thành, kế hoạch cho event chưa diễn ra
    const totalLeads      = events.reduce((s, e) => s + (e.status === 'completed' ? (e.leadsActual ?? e.leads ?? 0) : (e.leads ?? 0)), 0);
    const totalDeals      = events.reduce((s, e) => s + (e.status === 'completed' ? (e.dealsActual ?? e.deals ?? 0) : (e.deals ?? 0)), 0);
    const totalTestDrives = events.reduce((s, e) => s + (e.status === 'completed' ? (e.testDrivesActual ?? e.testDrives ?? 0) : (e.testDrives ?? 0)), 0);
    const totalGdtd       = events.reduce((s, e) => s + (e.status === 'completed' ? (e.gdtdActual ?? e.gdtd ?? 0) : (e.gdtd ?? 0)), 0);
    // Tổng kế hoạch để so sánh
    const planLeads       = events.reduce((s, e) => s + (e.leads ?? 0), 0);
    const planDeals       = events.reduce((s, e) => s + (e.deals ?? 0), 0);
    const completed       = events.filter(e => e.status === 'completed').length;
    const upcoming        = events.filter(e => e.status === 'upcoming').length;
    const inProgress      = events.filter(e => e.status === 'in_progress').length;
    const overdue         = events.filter(e => e.status === 'overdue').length;
    const utilPct         = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const cpl             = totalLeads > 0 ? Math.round((totalSpent / totalLeads) * 1_000_000) : 0;
    return { total: events.length, totalBudget, totalSpent, totalLeads, totalDeals, totalTestDrives, totalGdtd, planLeads, planDeals, completed, upcoming, inProgress, overdue, utilPct, cpl };
  }, [events]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const byTypeData = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, color: EVENT_TYPE_COLORS[l] || '#94a3b8' }));
  }, [events]);

  const byShowroomData = useMemo(() => {
    const t: Record<string, number> = {};
    events.forEach(e => {
      const sr = showrooms.find(s => s.code === e.showroom_code);
      const key = sr?.name || e.showroom;
      t[key] = (t[key] || 0) + e.budget;
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([l, v], i) => ({ label: l, value: v, color: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#EF4444','#84CC16'][i%8] }));
  }, [events, showrooms]);

  const byBrandData = useMemo(() => {
    const b: Record<string, number> = {};
    events.forEach(e => { 
      const brand = e.brands && e.brands.length > 0 ? e.brands[0] : 'Khác';
      b[brand] = (b[brand] || 0) + e.budget; 
    });
    return Object.entries(b).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([l, v], i) => ({ label: l, value: v, color: ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#06B6D4','#84CC16','#64748b'][i%8] }));
  }, [events]);

  const monthlyTrend  = useMemo(() => Array.from({ length: 12 }, (_, i) => (eventsByMonth[i+1] || []).length), [eventsByMonth]);
  const monthlyBudget = useMemo(() => Array.from({ length: 12 }, (_, i) => (eventsByMonth[i+1] || []).reduce((s, e) => s + e.budget, 0)), [eventsByMonth]);

  const upcomingDeadlines = useMemo(() => events
    .filter(e => e.status === 'upcoming' || e.status === 'in_progress' || e.status === 'overdue')
    .map(e => { 
      const [dd, mm, yy] = e.date.includes('/') ? e.date.split('/') : e.date.split('-').reverse(); 
      const d = new Date(+yy, +mm - 1, +dd); 
      return { ...e, daysUntil: Math.ceil((d.getTime() - today.getTime()) / 86_400_000) }; 
    })
    .filter(e => e.daysUntil <= UPCOMING_REMINDER_DAYS) // Chỉ nhắc sự kiện trong N ngày tới hoặc đã trễ
    .sort((a, b) => a.daysUntil - b.daysUntil)
  , [events]);

  if (!mounted) return null;

  // Helper period label
  const periodLabel =
    viewMode === 'month'   ? ` — Tháng ${month}/${year}` :
    viewMode === 'quarter' ? ` — Q${Math.ceil(month/3)}/${year}` :
                             ` — Năm ${year}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Quản trị sự kiện"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        filters={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FilterDropdown
              value={filterBrand || 'all'}
              options={[{ value: 'all', label: 'Tất cả Thương hiệu' }, ...visibleBrandOptions.map(b => ({ value: b.name, label: b.name }))]}
              onChange={(v: string) => setFilterBrand(v === 'all' ? null : v)}
              placeholder="Tất cả Thương hiệu"
              width={150}
            />
            <FilterDropdown
              value={filterShowroom || 'all'}
              options={[{ value: 'all', label: 'Tất cả Showroom' }, ...visibleShowroomNames.map(s => ({ value: s, label: s }))]}
              onChange={(v: string) => setFilterShowroom(v === 'all' ? null : v)}
              placeholder="Tất cả Showroom"
              width={150}
            />
            {(filterBrand || filterShowroom) && (
              <button
                onClick={() => { setFilterBrand(null); setFilterShowroom(null); }}
                style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
              >✕ Bỏ lọc</button>
            )}
          </div>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {kpis.completed  > 0 && <span className="header-badge header-badge-success"><CheckCircle2 size={11} />{kpis.completed} HT</span>}
              {kpis.inProgress > 0 && <span className="header-badge header-badge-info"><Activity size={11} />{kpis.inProgress} chạy</span>}
            </div>
            {canEditEvents && (
              <button
                className="button-erp-primary"
                onClick={() => {
                  // Nếu role bị giới hạn SR → mặc định SR đầu tiên được phép
                  const defaultSR = isRestrictedRole && allowedShowroomCodes.length > 0
                    ? showrooms.find(s => s.code === allowedShowroomCodes[0]) ?? showrooms[0]
                    : showrooms[0];
                  setModal({ mode: 'create', data: emptyEvent(month, defaultSR?.code || '', defaultSR?.name || '') });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} />Tạo sự kiện
              </button>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Row 1: KPI Cards */}
        <div style={{ display: 'flex', gap: 12 }}>
          <KPICard icon={CalendarCheck} label="Tổng sự kiện" value={kpis.total}
            subValue={`${kpis.completed} HT · ${kpis.inProgress} đang chạy · ${kpis.upcoming} sắp tới`}
            color="#3B82F6" trend="up" />
          <KPICard icon={Wallet} label="Tổng ngân sách" value={kpis.totalBudget} unit="tr"
            subValue={`Đã chi: ${formatNumber(kpis.totalSpent)} tr (${kpis.utilPct}%)`}
            color="#10B981" />
          <KPICard icon={Users} label="Tổng KHQT" value={kpis.totalLeads}
            subValue={kpis.cpl > 0 ? `CPL: ${formatNumber(kpis.cpl)}đ/lead` : '—'}
            color="#F59E0B" trend="up" />
          <KPICard icon={TrendingUp} label="Hợp đồng" value={kpis.totalDeals}
            subValue={kpis.totalLeads > 0 ? `CR: ${((kpis.totalDeals / kpis.totalLeads)*100).toFixed(1)}%` : '—'}
            color="#8B5CF6" />
        </div>

        {/* Row 2: Charts (3 cột) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

          {/* Bar chart: NS / Showroom */}
          <div className="chart-panel">
            <div className="chart-panel-title">
              <MapPin size={15} style={{ color: '#10B981' }} />Ngân sách / Showroom (tr)
            </div>
            {byShowroomData.length > 0
              ? <MiniBarChart data={byShowroomData} />
              : <div className="chart-empty">Chưa có dữ liệu</div>
            }
          </div>

          {/* Biểu đồ tròn: NS / Hãng */}
          <div className="chart-panel">
            <div className="chart-panel-title">
              <Flag size={15} style={{ color: '#EF4444' }} />Ngân sách / Hãng (tr)
            </div>
            {byBrandData.length > 0
              ? <DonutChart data={byBrandData} />
              : <div className="chart-empty">Chưa có dữ liệu</div>
            }
          </div>

          {/* Xu hướng năm */}
          <div className="chart-panel">
            <div className="chart-panel-title">
              <Activity size={15} style={{ color: '#8B5CF6' }} />Xu hướng {year}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Số lượng</div>
            <MonthlySparkline data={monthlyTrend} color="#3B82F6" />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, marginTop: 4 }}>Ngân sách (tr)</div>
            <MonthlySparkline data={monthlyBudget} color="#10B981" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'].map(l => <span key={l}>{l}</span>)}
            </div>
          </div>
        </div>

        {/* Row 3: Timeline + Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>

          {/* Timeline — Nhắc tiến độ */}
          <div className="timeline-panel">
            <div className="timeline-header">
              <Flag size={14} style={{ color: '#d97706' }} />
              <span className="timeline-header-title">Nhắc tiến độ</span>
              <span className="timeline-header-count">{upcomingDeadlines.length}</span>
            </div>
            <div className="chart-panel-scroll">
              {upcomingDeadlines.length === 0 ? (
                <div className="timeline-empty">
                  <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: '#10B981', display: 'block' }} />
                  Không có sự kiện cần nhắc
                </div>
              ) : upcomingDeadlines.map((ev, i) => {
                const isOverdue = ev.status === 'overdue';
                const isPast = ev.daysUntil < 0;
                const isToday = ev.daysUntil === 0;
                const isUrgent = ev.daysUntil > 0 && ev.daysUntil <= 3;
                
                const dot = isOverdue ? '#ef4444' : isToday ? '#3B82F6' : isUrgent ? '#f59e0b' : '#94a3b8';
                const itemClass = `timeline-item${isOverdue ? ' timeline-item-past' : isUrgent ? ' timeline-item-urgent' : ''}`;
                const bgWarning = isOverdue ? '#fef2f2' : isToday ? '#eff6ff' : 'transparent';
                
                return (
                  <div key={ev.id} className={itemClass} style={{ borderBottom: i < upcomingDeadlines.length - 1 ? '1px solid #f1f5f9' : 'none', background: bgWarning, padding: '10px 12px', transition: 'all 0.2s', borderRadius: i === upcomingDeadlines.length - 1 ? '0 0 6px 6px' : 0 }}>
                    <div className="timeline-item-connector">
                      <div className="timeline-dot" style={{ background: dot, boxShadow: `0 0 0 2px ${dot}44` }} />
                      {i < upcomingDeadlines.length - 1 && <div className="timeline-line" style={{ background: isOverdue ? '#fecaca' : '#e2e8f0' }} />}
                    </div>
                    <div className="timeline-item-content">
                      <div className="timeline-item-name" style={{ color: isOverdue ? '#b91c1c' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ev.name}
                        {isToday && <span style={{ padding: '2px 4px', background: '#3B82F6', color: '#fff', fontSize: 9, borderRadius: 3, fontWeight: 700 }}>NOW</span>}
                      </div>
                      <div className="timeline-item-meta">{ev.date.includes('-') ? ev.date.split('-').reverse().join('/') : ev.date} · {ev.showroom}</div>
                      <div className="timeline-item-countdown" style={{ marginTop: 2 }}>
                        {isOverdue ? (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>Trễ báo cáo {Math.abs(ev.daysUntil)} ngày!</span>
                        ) : isToday ? (
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>Đang diễn ra</span>
                        ) : (
                          <span style={{ color: isUrgent ? '#d97706' : '#64748b' }}>Còn {ev.daysUntil} ngày</span>
                        )}
                      </div>
                    </div>
                    
                    {canEditEvents && (isOverdue ? (
                      <button title="Cập nhật thông tin" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)', flexShrink: 0 }} onClick={() => setModal({ mode: 'edit', data: ev })}>
                        <Pencil size={12} /> Cập nhật
                      </button>
                    ) : (
                      <button title="Chỉnh sửa chung" className="timeline-item-edit-btn" onClick={() => setModal({ mode: 'edit', data: ev })}>
                        <Pencil size={11} />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Table */}
          <div className="table-panel">
            <div className="table-panel-header">
              <Calendar size={14} style={{ color: '#3B82F6' }} />
              <span className="table-panel-title">
                Danh sách sự kiện{periodLabel}
              </span>
              <span className="table-panel-count">({events.length})</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 6, padding: 2 }}>
                <button onClick={() => setTableMode('plan')} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', background: tableMode === 'plan' ? 'var(--color-primary)' : 'transparent', color: tableMode === 'plan' ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.15s' }}>Kế hoạch</button>
                <button onClick={() => setTableMode('actual')} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', background: tableMode === 'actual' ? '#059669' : 'transparent', color: tableMode === 'actual' ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.15s' }}>Thực hiện</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 28, textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left', minWidth: 120 }}>Sự kiện</th>
                    <th style={{ width: 80 }}>Thương hiệu</th>
                    <th style={{ width: 100 }}>Dòng xe</th>
                    <th style={{ width: 80 }}>Loại</th>
                    <th style={{ width: 85 }}>Trạng thái</th>
                    <th style={{ width: 90 }}>Showroom</th>
                    <th style={{ width: 78 }}>Ngày</th>
                    <th style={{ width: 64, textAlign: 'right' }}>NS (tr)</th>
                    <th style={{ width: 60, textAlign: 'right' }}>KHQT</th>
                    <th style={{ width: 55, textAlign: 'right' }}>Lái thử</th>
                    <th style={{ width: 55, textAlign: 'right' }}>GDTD</th>
                    <th style={{ width: 55, textAlign: 'right' }}>KHĐ</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr><td colSpan={14} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                      Chưa có sự kiện trong kỳ này —{' '}
                      <button onClick={() => {
                        const defaultSR = isRestrictedRole && allowedShowroomCodes.length > 0
                          ? showrooms.find(s => s.code === allowedShowroomCodes[0]) ?? showrooms[0]
                          : showrooms[0];
                        setModal({ mode: 'create', data: emptyEvent(month, defaultSR?.code || '', defaultSR?.name || '') });
                      }} style={{ border: 'none', background: 'none', color: 'var(--color-brand, #004B9B)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Tạo sự kiện mới</button>
                    </td></tr>
                  ) : events.map((ev, i) => {
                    const stCfg = STATUS_CONFIG[ev.status as EventStatus] || STATUS_CONFIG.upcoming;
                    const _bSet = new Set(DEMO_BRANDS.map(b => b.name));
                    const evBrands = ev.brands.filter(b => _bSet.has(b));
                    const evModels = ev.brands.filter(b => !_bSet.has(b));
                    const nsVal   = tableMode === 'plan' ? ev.budget            : (ev.budgetSpent ?? null);
                    const khqtVal = tableMode === 'plan' ? (ev.leads ?? null)   : (ev.leadsActual ?? null);
                    const ltVal   = tableMode === 'plan' ? (ev.testDrives ?? null) : (ev.testDrivesActual ?? null);
                    const gdtdVal = tableMode === 'plan' ? (ev.gdtd ?? null)    : (ev.gdtdActual ?? null);
                    const khdVal  = tableMode === 'plan' ? (ev.deals ?? null)   : (ev.dealsActual ?? null);
                    return (
                      <tr key={ev.id}>
                        <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{ev.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{ev.location}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {evBrands.length > 0 ? evBrands.map(b => (
                              <span key={b} style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: '#eff6ff', color: '#1d4ed8' }}>{b}</span>
                            )) : <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={evModels.join(', ')}>
                          {evModels.length > 0 ? (evModels.length <= 2 ? evModels.join(', ') : `${evModels.slice(0,2).join(', ')} +${evModels.length-2}`) : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: (EVENT_TYPE_COLORS[ev.type] || '#94a3b8') + '15', color: EVENT_TYPE_COLORS[ev.type] || '#94a3b8' }}>
                            {ev.type}
                          </span>
                        </td>
                        <td><span className="status-badge" style={{ color: stCfg.color }}>{stCfg.label}</span></td>
                        <td style={{ fontSize: 11 }}>{ev.showroom}</td>
                        <td style={{ fontSize: 11 }}>{ev.date.includes('-') ? ev.date.split('-').reverse().join('/') : ev.date}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {nsVal != null ? formatNumber(nsVal) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: '#3b82f6' }}>
                          {khqtVal != null ? formatNumber(khqtVal) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: '#06b6d4' }}>
                          {ltVal != null ? ltVal : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: '#f59e0b' }}>
                          {gdtdVal != null ? formatNumber(gdtdVal) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          {khdVal != null ? khdVal : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {canEditEvents && (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                              {tableMode === 'plan' ? (
                                <>
                                  <button title="Sửa sự kiện" className="action-btn" onClick={() => setModal({ mode: 'edit', data: ev })}>
                                    <Pencil size={11} /> Sửa
                                  </button>
                                  <button title="Xóa sự kiện" className="action-btn" style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => handleDeleteEvent(ev, month)}>
                                    <Trash2 size={11} /> Xóa
                                  </button>
                                  <button title="Báo cáo kết thúc" className="action-btn action-btn-success" onClick={() => setModal({ mode: 'close_report', data: ev })}>
                                    <FileCheck2 size={11} /> Kết thúc
                                  </button>
                                </>
                              ) : (
                                ev.reportLink ? (
                                  <a href={ev.reportLink} target="_blank" rel="noopener noreferrer" className="action-btn action-btn-success" style={{ textDecoration: 'none' }}>
                                    <Eye size={11} /> Báo cáo
                                  </a>
                                ) : (
                                  <button title="Nhập kết quả thực hiện" className="action-btn action-btn-success" onClick={() => setModal({ mode: 'close_report', data: ev })}>
                                    <FileCheck2 size={11} /> Nhập KQ
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {events.length > 0 && (
              <div className="table-panel-footer">
                <span>
                  <strong>NS:</strong> {formatNumber(kpis.totalSpent > 0 ? kpis.totalSpent : kpis.totalBudget)} tr
                  {kpis.totalSpent > 0 && <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 4 }}>/ KH:{formatNumber(kpis.totalBudget)}</span>}
                </span>
                <span><strong>Đã thực hiện:</strong> {kpis.completed}/{kpis.total} SK</span>
                <span>
                  <strong>KHQT:</strong> {formatNumber(kpis.totalLeads)}
                  {kpis.totalLeads !== kpis.planLeads && <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 4 }}>/ KH:{formatNumber(kpis.planLeads)}</span>}
                </span>
                <span><strong>Lái thử:</strong> {formatNumber(kpis.totalTestDrives)}</span>
                <span>
                  <strong>KHĐ:</strong> {formatNumber(kpis.totalDeals)}
                  {kpis.totalDeals !== kpis.planDeals && <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 4 }}>/ KH:{formatNumber(kpis.planDeals)}</span>}
                </span>
                <span className="table-panel-footer-spacer" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Eye size={11} />Shared với Lập kế hoạch
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {(modal.mode === 'create' || modal.mode === 'edit') && (
        <EventFormModal
          isNew={modal.mode === 'create'}
          initialData={modal.data}
          onClose={() => setModal({ mode: 'closed' })}
          onSave={async (ev) => {
            await upsertEvent(ev, month);
            setModal({ mode: 'closed' });
          }}
        />
      )}

      {modal.mode === 'close_report' && (
        <CloseReportModal
          ev={modal.data}
          onClose={() => setModal({ mode: 'closed' })}
          onSave={async (updated) => {
            await upsertEvent(updated, month);
            setModal({ mode: 'closed' });
          }}
        />
      )}

      {resultModalEvent && (
        <EventResultModal
          event={resultModalEvent}
          onClose={() => setResultModalEvent(null)}
          onSaved={(updated) => {
            setEventsByMonth(prev => {
              const arr = [...(prev[month] || [])];
              const idx = arr.findIndex(e => e.id === updated.id);
              if (idx >= 0) arr[idx] = updated;
              return { ...prev, [month]: arr };
            });
            mutateEvents();
            setResultModalEvent(null);
          }}
        />
      )}
    </div>
  );
}
