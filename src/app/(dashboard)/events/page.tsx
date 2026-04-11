'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import {
  CalendarCheck, MapPin, Users, Wallet, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, BarChart3, Activity, Calendar, Flag, Eye,
  Plus, X, Edit2, CalendarDays, Pencil, FileCheck2, ChevronDown,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import dynamic from 'next/dynamic';
import {
  fetchEventsFromDB, upsertEventToDB, inferEventStatus,
  EVENT_TYPE_COLORS, STATUS_CONFIG, PRIORITY_CONFIG,
  type EventItem, type EventsByMonth, type EventStatus, type EventPriority,
  emptyEvent
} from '@/lib/events-data';

// Lazy load Modals để giảm kích thước bundle ban đầu
const EventFormModal = dynamic(() => import('@/components/events/EventFormModal'), { ssr: false });
const CloseReportModal = dynamic(() => import('@/components/events/CloseReportModal'), { ssr: false });
import { KPICard, MiniBarChart, DonutChart, MonthlySparkline } from '@/components/events/EventDashboardCards';
import { useShowrooms } from '@/contexts/ShowroomsContext';

// ─── Modal state types ─────────────────────────────────────────────────────────
type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; data: EventItem }
  | { mode: 'edit';   data: EventItem }
  | { mode: 'close_report'; data: EventItem };  // báo cáo kết thúc

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  // ── Load & persist ────────────────────────────────────────────────────────
  const [eventsByMonth, setEventsByMonth] = useState<EventsByMonth>({});
  const { showroomNames } = useShowrooms();

  const loadData = useCallback(async () => {
    const data = await fetchEventsFromDB();
    setEventsByMonth(data);
  }, []);

  useEffect(() => {
    loadData().then(() => setMounted(true));
  }, [loadData]);

  // Focus sync
  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const upsertEvent = useCallback(async (ev: EventItem, targetMonth: number) => {
    const success = await upsertEventToDB(ev);
    if (!success) return;
    setEventsByMonth(prev => {
      const arr = [...(prev[targetMonth] || [])];
      const idx = arr.findIndex(e => e.id === ev.id);
      if (idx >= 0) arr[idx] = ev; else arr.push(ev);
      return { ...prev, [targetMonth]: arr };
    });
  }, []);

  // ── Events for current view ───────────────────────────────────────────────
  const today = new Date(2026, 3, 10);
  const events = useMemo<EventItem[]>(() => {
    let raw: EventItem[];
    if (viewMode === 'month')        raw = eventsByMonth[month] || [];
    else if (viewMode === 'quarter') { const q0 = (Math.ceil(month / 3) - 1) * 3 + 1; raw = [q0, q0+1, q0+2].flatMap(m => eventsByMonth[m] || []); }
    else                             raw = Array.from({ length: 12 }, (_, i) => eventsByMonth[i+1] || []).flat();
    return raw.map(ev => ({ ...ev, status: inferEventStatus(ev, today) }));
  }, [eventsByMonth, month, viewMode]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalBudget = events.reduce((s, e) => s + e.budget, 0);
    const totalSpent  = events.reduce((s, e) => s + (e.budgetSpent ?? 0), 0);
    const totalLeads  = events.reduce((s, e) => s + (e.leads ?? 0), 0);
    const totalDeals  = events.reduce((s, e) => s + (e.deals ?? 0), 0);
    const totalTestDrives = events.reduce((s, e) => s + (e.testDrives ?? 0), 0);
    const completed   = events.filter(e => e.status === 'completed').length;
    const upcoming    = events.filter(e => e.status === 'upcoming').length;
    const inProgress  = events.filter(e => e.status === 'in_progress').length;
    const utilPct     = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const cpl         = totalLeads > 0 ? Math.round((totalSpent / totalLeads) * 1_000_000) : 0;
    return { total: events.length, totalBudget, totalSpent, totalLeads, totalDeals, totalTestDrives, completed, upcoming, inProgress, utilPct, cpl };
  }, [events]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const byTypeData = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, color: EVENT_TYPE_COLORS[l] || '#94a3b8' }));
  }, [events]);

  const byShowroomData = useMemo(() => {
    const t: Record<string, number> = {};
    events.forEach(e => { t[e.showroom] = (t[e.showroom] || 0) + e.budget; });
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([l, v], i) => ({ label: l, value: v, color: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#EF4444','#84CC16'][i%8] }));
  }, [events]);

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
    .filter(e => e.status === 'upcoming' || e.status === 'in_progress')
    .map(e => { const [dd, mm, yy] = e.date.includes('/') ? e.date.split('/') : e.date.split('-').reverse(); const d = new Date(+yy, +mm - 1, +dd); return { ...e, daysUntil: Math.ceil((d.getTime() - today.getTime()) / 86_400_000) }; })
    .sort((a, b) => a.daysUntil - b.daysUntil)
  , [events]);

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Quản trị sự kiện"
        year={year} month={month} viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display:'flex', gap:4 }}>
              {kpis.completed > 0 && <span style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', fontSize:11, fontWeight:600, color:'#059669', background:'#ecfdf5', borderRadius:4, border:'1px solid #bbf7d0' }}><CheckCircle2 size={12} />{kpis.completed} HT</span>}
              {kpis.inProgress > 0 && <span style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', fontSize:11, fontWeight:600, color:'#2563eb', background:'#eff6ff', borderRadius:4, border:'1px solid #bfdbfe' }}><Activity size={12} />{kpis.inProgress} đang chạy</span>}
              {kpis.upcoming > 0 && <span style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', fontSize:11, fontWeight:600, color:'#d97706', background:'#fffbeb', borderRadius:4, border:'1px solid #fde68a' }}><Clock size={12} />{kpis.upcoming} sắp tới</span>}
            </div>
            <button
              className="button-erp-primary"
              onClick={() => setModal({ mode: 'create', data: emptyEvent(month, showroomNames[0] || '') })}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />Tạo sự kiện
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Row 1: KPI Cards */}
        <div style={{ display: 'flex', gap: 12 }}>
          <KPICard icon={CalendarCheck} label="Tổng sự kiện" value={kpis.total}
            subValue={`${kpis.completed} HT · ${kpis.inProgress} đang chạy · ${kpis.upcoming} sắp tới`} color="#3B82F6" trend="up" />
          <KPICard icon={Wallet} label="Tổng ngân sách" value={kpis.totalBudget} unit="tr"
            subValue={`Đã chi: ${formatNumber(kpis.totalSpent)} tr (${kpis.utilPct}%)`} color="#10B981" />
          <KPICard icon={Users} label="Tổng KHQT" value={kpis.totalLeads}
            subValue={kpis.cpl > 0 ? `CPL: ${formatNumber(kpis.cpl)}đ` : '—'} color="#F59E0B" trend="up" />
          <KPICard icon={TrendingUp} label="Hợp đồng" value={kpis.totalDeals}
            subValue={kpis.totalLeads > 0 ? `CR: ${((kpis.totalDeals / kpis.totalLeads)*100).toFixed(1)}%` : '—'} color="#8B5CF6" />
        </div>

        {/* Row 2: Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={15} style={{ color: '#3B82F6' }} />Sự kiện / Nhóm</div>
            <DonutChart data={byTypeData} />
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} style={{ color: '#10B981' }} />Ngân sách / Showroom (tr)</div>
            {byShowroomData.length > 0 ? <MiniBarChart data={byShowroomData} /> : <div style={{ color:'var(--color-text-muted)', fontSize:12, padding:20, textAlign:'center' }}>Chưa có dữ liệu</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Flag size={15} style={{ color: '#EF4444' }} />Ngân sách / Hãng (tr)</div>
            {byBrandData.length > 0 ? <DonutChart data={byBrandData} /> : <div style={{ color:'var(--color-text-muted)', fontSize:12, padding:20, textAlign:'center' }}>Chưa có dữ liệu</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={15} style={{ color: '#8B5CF6' }} />Xu hướng {year}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Số lượng</div>
            <MonthlySparkline data={monthlyTrend} color="#3B82F6" />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, marginTop: 4 }}>Ngân sách (tr)</div>
            <MonthlySparkline data={monthlyBudget} color="#10B981" />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--color-text-muted)', marginTop:2 }}>
              {['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'].map(l => <span key={l}>{l}</span>)}
            </div>
          </div>
        </div>

        {/* Row 3: Timeline + Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>

          {/* Timeline */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', flexShrink: 0 }}>
              <Flag size={14} style={{ color: '#d97706' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Nhắc tiến độ</span>
              <span style={{ marginLeft:'auto', fontSize:10, fontWeight:600, padding:'2px 7px', background:'#fbbf24', color:'#78350f', borderRadius:10 }}>{upcomingDeadlines.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {upcomingDeadlines.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: '#10B981' }} />Không có sự kiện cần nhắc
                </div>
              ) : upcomingDeadlines.map((ev, i) => {
                const isPast = ev.daysUntil < 0, isToday = ev.daysUntil === 0, isUrgent = ev.daysUntil <= 3 && !isPast;
                const dot = isPast ? '#ef4444' : isToday ? '#3B82F6' : isUrgent ? '#f59e0b' : '#94a3b8';
                return (
                  <div key={ev.id} style={{ padding: '9px 14px', borderBottom: i < upcomingDeadlines.length-1 ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 8, alignItems: 'flex-start', background: isPast ? '#fef2f2' : isUrgent ? '#fefce8' : 'transparent' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:2, flexShrink:0 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:dot, boxShadow:`0 0 0 2px ${dot}44` }} />
                      {i < upcomingDeadlines.length-1 && <div style={{ width:1, flex:1, minHeight:16, background:'#e2e8f0', marginTop:3 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--color-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.name}</div>
                      <div style={{ fontSize:10, color:'var(--color-text-muted)' }}>{ev.date} · {ev.showroom}</div>
                      <div style={{ fontSize:10, fontWeight:700, color: isPast?'#dc2626':isToday?'#2563eb':isUrgent?'#d97706':'#64748b' }}>
                        {isPast ? `Quá hạn ${Math.abs(ev.daysUntil)}d` : isToday ? '📍 Hôm nay!' : `Còn ${ev.daysUntil} ngày`}
                      </div>
                    </div>
                    <button title="Sửa" onClick={() => setModal({ mode: 'edit', data: ev })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                      <Pencil size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Table */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Calendar size={14} style={{ color: '#3B82F6' }} />
              <span style={{ fontSize:13, fontWeight:700, color:'var(--color-text)' }}>
                Danh sách sự kiện
                {viewMode==='month' && ` — Tháng ${month}/${year}`}
                {viewMode==='quarter' && ` — Q${Math.ceil(month/3)}/${year}`}
                {viewMode==='year' && ` — Năm ${year}`}
              </span>
              <span style={{ fontSize:11, color:'var(--color-text-muted)', marginLeft:2 }}>({events.length})</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width:28, textAlign:'center' }}>#</th>
                    <th style={{ textAlign:'left', minWidth:160 }}>Sự kiện</th>
                    <th style={{ width:90 }}>Loại</th>
                    <th style={{ width:95 }}>Trạng thái</th>
                    <th style={{ width:100 }}>Showroom</th>
                    <th style={{ width:78 }}>Ngày</th>
                    <th style={{ width:54, textAlign:'right' }}>NS (tr)</th>
                    <th style={{ width:54, textAlign:'right' }}>KHQT</th>
                    <th style={{ width:52, textAlign:'right' }}>Lái thử</th>
                    <th style={{ width:50, textAlign:'right' }}>GDTD</th>
                    <th style={{ width:44, textAlign:'right' }}>KHĐ</th>
                    <th style={{ width:100, textAlign:'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:'var(--color-text-muted)' }}>
                      Chưa có sự kiện trong kỳ này —{' '}
                      <button onClick={() => setModal({ mode: 'create', data: emptyEvent(month, showroomNames[0] || '') })} style={{ border:'none', background:'none', color:'var(--color-brand, #004B9B)', cursor:'pointer', fontWeight:600, fontSize:13 }}>Tạo sự kiện mới</button>
                    </td></tr>
                  ) : events.map((ev, i) => {
                    const stCfg = STATUS_CONFIG[ev.status as EventStatus] || STATUS_CONFIG.upcoming;
                    return (
                      <tr key={ev.id}>
                        <td style={{ textAlign:'center', color:'var(--color-text-muted)' }}>{i+1}</td>
                        <td>
                          <div style={{ fontWeight:600 }}>{ev.name}</div>
                          <div style={{ fontSize:10, color:'var(--color-text-muted)' }}>{ev.location}</div>
                        </td>
                        <td><span style={{ fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:3, background:(EVENT_TYPE_COLORS[ev.type]||'#94a3b8')+'15', color:EVENT_TYPE_COLORS[ev.type]||'#94a3b8' }}>{ev.type}</span></td>
                        <td><span style={{ fontSize:11, fontWeight:600, color:stCfg.color }}>{stCfg.label}</span></td>
                        <td style={{ fontSize:11 }}>{ev.showroom}</td>
                        <td style={{ fontSize:11 }}>{ev.date.includes('-') ? ev.date.split('-').reverse().join('/') : ev.date}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{formatNumber(ev.budget)}</td>
                        <td style={{ textAlign:'right', color:'#3b82f6' }}>{ev.leads != null ? formatNumber(ev.leads) : '—'}</td>
                        <td style={{ textAlign:'right', color:'#06b6d4' }}>{ev.testDrives != null ? ev.testDrives : '—'}</td>
                        <td style={{ textAlign:'right', color:'#f59e0b' }}>{ev.gdtd != null ? formatNumber(ev.gdtd) : '—'}</td>
                        <td style={{ textAlign:'right', color:'#10b981', fontWeight:600 }}>{ev.deals || '—'}</td>
                        <td style={{ textAlign:'center' }}>
                          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                            <button title="Chỉnh sửa" onClick={() => setModal({ mode: 'edit', data: ev })}
                              style={{ border:'1px solid var(--color-border)', borderRadius:4, background:'#fff', cursor:'pointer', padding:'2px 6px', display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--color-text-secondary)' }}>
                              <Pencil size={11} /> Sửa
                            </button>
                            {ev.status !== 'completed' && (
                              <button title="Báo cáo kết thúc" onClick={() => setModal({ mode: 'close_report', data: ev })}
                                style={{ border:'1px solid #bbf7d0', borderRadius:4, background:'#ecfdf5', cursor:'pointer', padding:'2px 6px', display:'flex', alignItems:'center', gap:3, fontSize:11, color:'#059669' }}>
                                <FileCheck2 size={11} /> Kết thúc
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {events.length > 0 && (
              <div style={{ padding:'7px 16px', borderTop:'1px solid var(--color-border)', display:'flex', gap:16, alignItems:'center', flexShrink:0, background:'#f8fafc', fontSize:11, color:'var(--color-text-secondary)' }}>
                <span><strong>Tổng NS:</strong> {formatNumber(kpis.totalBudget)} tr</span>
                <span><strong>Đã thực hiện:</strong> {kpis.completed} sự kiện</span>
                <span><strong>KHQT:</strong> {formatNumber(kpis.totalLeads)}</span>
                <span><strong>Lái thử:</strong> {formatNumber(kpis.totalTestDrives)}</span>
                <span><strong>KHĐ:</strong> {formatNumber(kpis.totalDeals)}</span>
                <span style={{ marginLeft:'auto', color:'var(--color-text-muted)' }}><Eye size={11} style={{ verticalAlign:'middle', marginRight:3 }} />Shared với Lập kế hoạch</span>
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
    </div>
  );
}
