'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, ArrowRight, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle2,
  List, LayoutGrid, ClipboardCheck, ChevronRight,
} from 'lucide-react';
import { fetchEventsFromDB, type EventItem } from '@/lib/events-data';
import { createClient } from '@/lib/supabase/client';
import { useShowrooms, type ShowroomItem } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';

interface BudgetPlanSummary {
  showroom_code: string;
  month: number;
  year: number;
  approval_status: 'draft' | 'submitted' | 'approved';
}

interface SubmissionRow {
  showroom_id: string;
  brand: string;
  entry_type: string;
  status: string;
  sent_at: string | null;
  sent_by_name: string | null;
}

import { generateIntelligentTasks, type Task, type SystemTaskType, type TaskPriority, type TaskCategory } from '@/lib/tasks-engine';
import { fetchManualTasks, completeManualTask } from '@/lib/tasks-data';
import { useAuth } from '@/contexts/AuthContext';
import { TaskCreateModal } from '@/components/tasks/TaskCreateModal';

// ─── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  urgent:     { label: 'Khẩn cấp',  icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  this_week:  { label: 'Tuần này',  icon: Clock,         color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  this_month: { label: 'Tháng này', icon: Calendar,      color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
};

const TYPE_LABEL: Record<SystemTaskType, string> = {
  report_event:    'Báo cáo',
  confirm_event:   'Xác nhận lịch',
  upcoming_event:  'Sắp tới',
  pre_event_check: 'Chuẩn bị',
  submit_plan:     'Kế hoạch',
  budget_overrun:  'Ngân sách',
  manual:          'Tự tạo',
};

// Tasks generation is now handled by @/lib/tasks-engine

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const { profile, effectiveRole } = useAuth();
  const { showrooms } = useShowrooms();
  const { activeUnitId } = useUnit();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeMainTab, setActiveMainTab] = useState<'tasks' | 'tracking'>('tasks');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlanSummary[]>([]);
  const [manualTasks, setManualTasks] = useState<Task[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');

  // ── Tracking tab state ─────────────────────────────────────────────────────
  const now = new Date();
  const [trackingMonth, setTrackingMonth] = useState(now.getMonth() + 1);
  const [trackingYear, setTrackingYear] = useState(now.getFullYear());
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  // Showrooms visible to this user for tracking
  const trackingShowrooms = useMemo(() => {
    if (effectiveRole === 'mkt_brand' && profile?.brands?.length) {
      return showrooms.filter(s => s.brands.some(b => profile.brands!.includes(b)));
    }
    if (['gd_showroom', 'mkt_showroom'].includes(effectiveRole as string)) {
      const myCodes = profile?.showroom_ids?.length
        ? profile.showroom_ids
        : profile?.showroom?.code ? [profile.showroom.code] : [];
      return showrooms.filter(s => myCodes.includes(s.code));
    }
    return showrooms;
  }, [showrooms, effectiveRole, profile]);

  const loadTracking = useCallback(async () => {
    if (trackingShowrooms.length === 0) return;
    setTrackingLoading(true);
    try {
      const supabase = createClient();
      const ids = trackingShowrooms.map(s => s.id);
      const { data } = await supabase
        .from('thaco_plan_submissions')
        .select('showroom_id, brand, entry_type, status, sent_at, sent_by_name')
        .eq('year', trackingYear)
        .eq('month', trackingMonth)
        .in('showroom_id', ids);
      setSubmissions(data ?? []);
    } finally {
      setTrackingLoading(false);
    }
  }, [trackingShowrooms, trackingYear, trackingMonth]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) loadData(); }, [mounted]);
  useEffect(() => { if (mounted && activeMainTab === 'tracking') loadTracking(); }, [mounted, activeMainTab, trackingMonth, trackingYear, loadTracking]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const showroom = profile?.showroom?.name || '';
      const supabase = createClient();
      const [eventsData, submissionsResult, mTasksData] = await Promise.all([
        fetchEventsFromDB(),
        supabase
          .from('thaco_plan_submissions')
          .select('showroom_id, year, month, entry_type, status')
          .eq('year', new Date().getFullYear()),
        fetchManualTasks(showroom)
      ]);
      const budgetPlans: BudgetPlanSummary[] = (submissionsResult.data ?? []).map((s: any) => ({
        showroom_code: '',
        month: s.month,
        year: s.year,
        approval_status: s.status === 'sent' ? 'submitted' : 'draft',
      }));
      setEvents(Object.values(eventsData).flat());
      setBudgetPlans(budgetPlans);
      setManualTasks(mTasksData);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Tasks: load error', err);
      setLoadError(err?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  const tasks = useMemo(() => {
    if (!mounted) return [];
    const systemTasks = generateIntelligentTasks(events, budgetPlans, {
      role: effectiveRole || '',
      showroom: profile?.showroom?.name || '',
      brands: profile?.brands ?? undefined,
    });
    const openManual = manualTasks.filter(t => t.status !== 'completed');
    return [...systemTasks, ...openManual];
  }, [events, budgetPlans, mounted, profile, effectiveRole, manualTasks]);

  const completedManualTasks = useMemo(
    () => manualTasks.filter(t => t.status === 'completed'),
    [manualTasks]
  );

  const filteredTasks = useMemo(() => {
    if (categoryFilter === 'all') return tasks;
    return tasks.filter(t => t.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const categoryCounts = useMemo<Record<'all' | TaskCategory, number>>(() => ({
    all:    tasks.length,
    event:  tasks.filter(t => t.category === 'event').length,
    plan:   tasks.filter(t => t.category === 'plan').length,
    budget: tasks.filter(t => t.category === 'budget').length,
    manual: tasks.filter(t => t.category === 'manual').length,
  }), [tasks]);

  const groups = useMemo<Record<TaskPriority, Task[]>>(() => ({
    urgent:     filteredTasks.filter(t => t.priority === 'urgent'),
    this_week:  filteredTasks.filter(t => t.priority === 'this_week'),
    this_month: filteredTasks.filter(t => t.priority === 'this_month'),
  }), [filteredTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      await completeManualTask(taskId);
      setManualTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
    } catch (err) {
      console.error('Tasks: complete error', err);
    }
  }, []);

  if (!mounted) return null;

  const urgentCount = groups.urgent.length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: activeMainTab === 'tasks' && viewMode === 'kanban' ? 1200 : 900, margin: '0 auto', transition: 'max-width 0.2s', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setActiveMainTab('tasks')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: activeMainTab === 'tasks' ? 'var(--color-primary)' : 'var(--color-bg-hover)',
              color: activeMainTab === 'tasks' ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid',
              borderColor: activeMainTab === 'tasks' ? 'var(--color-primary)' : 'var(--color-border)',
              borderRadius: 'var(--border-radius-erp) 0 0 var(--border-radius-erp)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            <Bell size={13} />
            Việc cần làm
            {!loading && tasks.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 4px',
                background: activeMainTab === 'tasks' ? 'rgba(255,255,255,0.25)' : (urgentCount > 0 ? '#dc2626' : '#d97706'),
                color: '#fff', borderRadius: 9, fontSize: 10, fontWeight: 700,
              }}>
                {tasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveMainTab('tracking')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: activeMainTab === 'tracking' ? 'var(--color-primary)' : 'var(--color-bg-hover)',
              color: activeMainTab === 'tracking' ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid',
              borderColor: activeMainTab === 'tracking' ? 'var(--color-primary)' : 'var(--color-border)',
              borderRadius: '0 var(--border-radius-erp) var(--border-radius-erp) 0',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            <ClipboardCheck size={13} />
            Kiểm soát nộp KH
          </button>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeMainTab === 'tasks' && (
            <div style={{ display: 'flex', background: 'var(--color-surface-hover)', padding: 3, borderRadius: 'var(--border-radius-erp)' }}>
              <button
                onClick={() => setViewMode('list')}
                style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, background: viewMode === 'list' ? 'var(--color-surface-elevated)' : 'transparent', borderRadius: 4, boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
              >
                <List size={13} /> Danh sách
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, background: viewMode === 'kanban' ? 'var(--color-surface-elevated)' : 'transparent', borderRadius: 4, boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'kanban' ? 'var(--color-text)' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
              >
                <LayoutGrid size={13} /> Kanban
              </button>
            </div>
          )}
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
            {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={activeMainTab === 'tasks' ? loadData : loadTracking}
            disabled={activeMainTab === 'tasks' ? loading : trackingLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-erp)',
              fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', fontWeight: 500,
              cursor: (activeMainTab === 'tasks' ? loading : trackingLoading) ? 'not-allowed' : 'pointer',
              opacity: (activeMainTab === 'tasks' ? loading : trackingLoading) ? 0.6 : 1,
              transition: 'all 0.1s',
            }}
          >
            <RefreshCw size={14} style={{ animation: (activeMainTab === 'tasks' ? loading : trackingLoading) ? 'spin 1s linear infinite' : 'none' }} />
            Tải lại
          </button>
          {activeMainTab === 'tasks' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                padding: '6px 14px',
                background: 'var(--color-primary)', color: '#fff', border: 'none',
                borderRadius: 'var(--border-radius-erp)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 4px rgba(11, 87, 208, 0.2)',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tạo việc
            </button>
          )}
        </div>
      </div>

      {/* ── Tasks Tab ──────────────────────────────────────────────────────── */}
      {activeMainTab === 'tasks' && (<>

        {/* Filter Pills */}
        {!loading && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { key: 'all',    label: 'Tất cả' },
              { key: 'event',  label: 'Sự kiện' },
              { key: 'plan',   label: 'Kế hoạch' },
              { key: 'budget', label: 'Ngân sách' },
              { key: 'manual', label: 'Tự tạo' },
            ] as const).map(({ key, label }) => {
              const isActive = categoryFilter === key;
              const count = categoryCounts[key];
              return (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px 4px 12px',
                    borderRadius: 16,
                    border: '1px solid',
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-primary)' : 'var(--color-bg-hover)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                    transition: 'all 0.1s',
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 8, fontSize: 10, fontWeight: 700,
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-hover)',
                      color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Summary Chips */}
        {!loading && tasks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              const count = groups[p].length;
              if (count === 0) return null;
              const Icon = cfg.icon;
              return (
                <div key={p} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px',
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 20, fontSize: 'var(--fs-label)',
                }}>
                  <Icon size={12} color={cfg.color} />
                  <span style={{ fontWeight: 600, color: cfg.color }}>{count}</span>
                  <span style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
            Đang tải...
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', borderRadius: 'var(--border-radius-erp)',
            background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626',
          }}>
            <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-body)', color: '#991b1b', flex: 1 }}>{loadError}</span>
            <button onClick={loadData} style={{ fontSize: 12, padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              Thử lại
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-erp)',
            color: 'var(--color-text-muted)',
          }}>
            <CheckCircle2 size={36} color="#22c55e" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' }}>Tất cả đã hoàn thành!</div>
            <div style={{ fontSize: 'var(--fs-body)' }}>Không có việc nào cần nhắc nhở lúc này.</div>
          </div>
        )}

        {/* Task Groups (list view) */}
        {!loading && tasks.length > 0 && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {(['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(priority => {
              const groupTasks = groups[priority];
              if (groupTasks.length === 0) return null;
              const cfg = PRIORITY_CONFIG[priority];
              const Icon = cfg.icon;
              return (
                <div key={priority}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 8, paddingBottom: 6,
                    borderBottom: `2px solid ${cfg.border}`,
                  }}>
                    <Icon size={14} color={cfg.color} />
                    <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18,
                      background: cfg.color, color: '#fff',
                      borderRadius: '50%', fontSize: 10, fontWeight: 700,
                    }}>
                      {groupTasks.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        priorityCfg={cfg}
                        onNavigate={() => router.push(task.deepLink)}
                        onComplete={task.type === 'manual' ? () => handleCompleteTask(task.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kanban View */}
        {!loading && tasks.length > 0 && viewMode === 'kanban' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'flex-start', flex: 1 }}>
            {(['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(priority => {
              const groupTasks = groups[priority];
              const cfg = PRIORITY_CONFIG[priority];
              const Icon = cfg.icon;
              return (
                <div key={priority} style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)', minHeight: 'calc(100vh - 200px)' }}>
                  <div style={{ padding: '14px 16px', background: cfg.bg, borderBottom: `2px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} color={cfg.color} />
                      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cfg.label}</span>
                    </div>
                    <span style={{ background: cfg.color, color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                      {groupTasks.length}
                    </span>
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                    {groupTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0', border: '1px dashed #cbd5e1', borderRadius: 6, margin: 4 }}>Không có việc trong nhóm này</div>
                    ) : (
                      groupTasks.map(task => (
                        <TaskKanbanCard
                          key={task.id}
                          task={task}
                          priorityCfg={cfg}
                          onNavigate={() => router.push(task.deepLink)}
                          onComplete={task.type === 'manual' ? () => handleCompleteTask(task.id) : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Section */}
        {!loading && viewMode === 'list' && completedManualTasks.length > 0 && (
          <CompletedSection tasks={completedManualTasks} />
        )}
      </>)}

      {/* ── Tracking Tab ───────────────────────────────────────────────────── */}
      {activeMainTab === 'tracking' && (
        <TrackingView
          showrooms={trackingShowrooms}
          submissions={submissions}
          loading={trackingLoading}
          month={trackingMonth}
          year={trackingYear}
          onMonthChange={setTrackingMonth}
          onYearChange={setTrackingYear}
          onNavigate={(showroomName) => router.push(`/planning?showroom=${encodeURIComponent(showroomName)}`)}
        />
      )}

      {/* ── Create Modal ────────────────────────────────────────────────────── */}
      {isCreateModalOpen && profile && (
        <TaskCreateModal
          isOpen={isCreateModalOpen}
          initialShowroom={profile?.showroom?.name || ''}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadData();
          }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Tracking View ────────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-erp)',
  fontSize: 12, background: '#fff',
  color: 'var(--color-text)', cursor: 'pointer',
};

function SummaryBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: bg, border: `1px solid ${border}`, borderRadius: 14, fontSize: 11 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function TrackingView({
  showrooms, submissions, loading, month, year, onMonthChange, onYearChange, onNavigate,
}: {
  showrooms: ShowroomItem[];
  submissions: SubmissionRow[];
  loading: boolean;
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  onNavigate: (showroomName: string) => void;
}) {
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterSR, setFilterSR] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'unsent'>('all');

  // subMap key: `${srId}|${brand}|${entry_type}`  — brand='' là cả showroom
  const subMap = useMemo(() => {
    const m: Record<string, SubmissionRow> = {};
    for (const s of submissions) {
      m[`${s.showroom_id}|${s.brand}|${s.entry_type}`] = s;
    }
    return m;
  }, [submissions]);

  // Tra cứu EXACT MATCH — không fallback, tránh brand='Tải Bus' nhầm với 'DVPT Tải Bus'
  function getSub(srId: string, brand: string, type: string): SubmissionRow | undefined {
    return subMap[`${srId}|${brand}|${type}`];
  }
  // Tra cứu bản ghi GD nộp cả showroom (brand='')
  function getWholeSRSub(srId: string, type: string): SubmissionRow | undefined {
    return subMap[`${srId}||${type}`];
  }

  // Thương hiệu duy nhất cho filter dropdown
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    showrooms.forEach(sr => sr.brands.forEach(b => set.add(b)));
    return Array.from(set).sort();
  }, [showrooms]);

  // Showrooms sau khi lọc SR + brand
  const filteredShowrooms = useMemo(() =>
    showrooms
      .filter(sr => filterSR === 'all' || sr.id === filterSR)
      .filter(sr => filterBrand === 'all' || sr.brands.includes(filterBrand))
  , [showrooms, filterSR, filterBrand]);

  // Tổng hợp để hiện summary badges — chỉ đếm exact brand submissions
  const summary = useMemo(() => {
    let total = 0, planSent = 0, actualSent = 0;
    for (const sr of filteredShowrooms) {
      const brands = sr.brands.length > 0
        ? (filterBrand === 'all' ? sr.brands : [filterBrand])
        : [];
      for (const b of brands) {
        total++;
        if (subMap[`${sr.id}|${b}|plan`]?.status === 'sent') planSent++;
        if (subMap[`${sr.id}|${b}|actual`]?.status === 'sent') actualSent++;
      }
    }
    return { total, planSent, actualSent };
  }, [filteredShowrooms, filterBrand, subMap]);

  const yearOptions = [2025, 2026, 2027];
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <select value={month} onChange={e => onMonthChange(Number(e.target.value))} style={SELECT_STYLE}>
          {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={e => onYearChange(Number(e.target.value))} style={SELECT_STYLE}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 2px' }} />

        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={SELECT_STYLE}>
          <option value="all">Tất cả thương hiệu</option>
          {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterSR} onChange={e => setFilterSR(e.target.value)} style={SELECT_STYLE}>
          <option value="all">Tất cả showroom</option>
          {showrooms.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
        </select>

        {/* Status quick-filter */}
        <div style={{ display: 'flex', background: 'var(--color-surface-hover)', padding: 2, borderRadius: 6, gap: 1, marginLeft: 'auto' }}>
          {(['all', 'unsent', 'sent'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              borderRadius: 4, transition: 'all 0.1s',
              background: filterStatus === s ? 'var(--color-surface-elevated)' : 'transparent',
              color: filterStatus === s ? 'var(--color-text)' : 'var(--color-text-secondary)',
              boxShadow: filterStatus === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}>
              {s === 'all' ? 'Tất cả' : s === 'unsent' ? 'Chưa nộp KH' : 'Đã nộp KH'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary badges ─────────────────────────────────────────────────── */}
      {!loading && summary.total > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SummaryBadge color="#16a34a" bg="#f0fdf4" border="#86efac"
            label={`KH: ${summary.planSent}/${summary.total} TH đã nộp`} />
          <SummaryBadge color="#2563eb" bg="#eff6ff" border="#93c5fd"
            label={`TH: ${summary.actualSent}/${summary.total} TH đã nộp`} />
          {summary.total - summary.planSent > 0 && (
            <SummaryBadge color="#d97706" bg="#fffbeb" border="#fcd34d"
              label={`Còn ${summary.total - summary.planSent} thương hiệu chưa nộp KH`} />
          )}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>Đang tải...</div>
      ) : filteredShowrooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>Không có dữ liệu phù hợp.</div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-erp)', overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', background: '#f8fafc', borderBottom: '2px solid var(--color-border)' }}>
            {['Showroom / Thương hiệu', 'Kế hoạch', 'Thực hiện'].map((label, i) => (
              <div key={label} style={{
                padding: '9px 14px', fontSize: 11, fontWeight: 700,
                color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* SR groups */}
          {filteredShowrooms.map((sr, srIdx) => {
            // Brands của SR (theo filter thương hiệu)
            const srBrands = filterBrand === 'all'
              ? sr.brands
              : sr.brands.filter(b => b === filterBrand);

            // Bản ghi GD nộp cả SR (brand='') — tách riêng, không ánh xạ sang từng brand
            const wholePlanSub   = getWholeSRSub(sr.id, 'plan');
            const wholeActualSub = getWholeSRSub(sr.id, 'actual');
            const hasWholeSR = !!(wholePlanSub || wholeActualSub);

            // Lọc brand rows theo trạng thái KH (chỉ áp dụng cho brand-specific rows)
            const visibleBrands = srBrands.filter(b => {
              if (filterStatus === 'all') return true;
              const sent = getSub(sr.id, b, 'plan')?.status === 'sent';
              return filterStatus === 'sent' ? sent : !sent;
            });

            // Ẩn SR nếu không có gì để hiện (không có brand row, không có whole-SR row)
            if (visibleBrands.length === 0 && !hasWholeSR) return null;

            const isLastSR = srIdx === filteredShowrooms.length - 1
              || filteredShowrooms.slice(srIdx + 1).every(s => {
                const sBrands = filterBrand === 'all' ? s.brands : s.brands.filter(b => b === filterBrand);
                const hasWhole = !!(subMap[`${s.id}||plan`] || subMap[`${s.id}||actual`]);
                const visible = sBrands.filter(b => {
                  if (filterStatus === 'all') return true;
                  const sent = subMap[`${s.id}|${b}|plan`]?.status === 'sent';
                  return filterStatus === 'sent' ? sent : !sent;
                });
                return visible.length === 0 && !hasWhole;
              });

            // Progress KH: chỉ đếm exact brand submissions
            const planSentInSR = srBrands.filter(b => getSub(sr.id, b, 'plan')?.status === 'sent').length;
            const totalBrandsInSR = srBrands.length;
            const progressColor = planSentInSR === 0 ? '#ef4444' : planSentInSR === totalBrandsInSR ? '#16a34a' : '#d97706';
            const progressBg    = planSentInSR === 0 ? '#fee2e2' : planSentInSR === totalBrandsInSR ? '#dcfce7' : '#fef9c3';

            return (
              <div key={sr.id} style={{ borderBottom: isLastSR ? 'none' : '1px solid var(--color-border)' }}>

                {/* SR header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', background: '#eef2ff', borderBottom: '1px solid #e0e7ff' }}>
                  <div style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3730a3' }}>{sr.name}</span>
                    {totalBrandsInSR > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: progressColor,
                        background: progressBg, padding: '1px 7px', borderRadius: 10,
                      }}>
                        KH: {planSentInSR}/{totalBrandsInSR} TH
                      </span>
                    )}
                  </div>
                  <div style={{ borderLeft: '1px solid #e0e7ff' }} />
                  <div style={{ borderLeft: '1px solid #e0e7ff' }} />
                </div>

                {/* Hàng GD nộp cả SR (brand='') — chỉ hiện khi có, tách khỏi brand rows */}
                {hasWholeSR && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', background: '#fdf4ff', borderBottom: visibleBrands.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ padding: '9px 14px 9px 26px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}>Toàn showroom (GD)</span>
                    </div>
                    <SubmissionCell sub={wholePlanSub}   onNavigate={() => onNavigate(sr.name)} />
                    <SubmissionCell sub={wholeActualSub} onNavigate={() => onNavigate(sr.name)} />
                  </div>
                )}

                {/* Brand rows — exact match, không fallback */}
                {visibleBrands.map((brand, bIdx) => (
                  <div key={brand} style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr',
                    background: bIdx % 2 === 0 ? '#fff' : '#fafafa',
                    borderBottom: bIdx < visibleBrands.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{ padding: '10px 14px 10px 26px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{brand}</span>
                    </div>
                    <SubmissionCell sub={getSub(sr.id, brand, 'plan')}   onNavigate={() => onNavigate(sr.name)} />
                    <SubmissionCell sub={getSub(sr.id, brand, 'actual')} onNavigate={() => onNavigate(sr.name)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Submission Cell ───────────────────────────────────────────────────────────

function SubmissionCell({ sub, onNavigate }: { sub: SubmissionRow | undefined; onNavigate: () => void }) {
  const [hovered, setHovered] = useState(false);
  const sent = sub?.status === 'sent';

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px 14px',
        borderLeft: '1px solid var(--color-border)',
        cursor: 'pointer',
        background: hovered ? (sent ? '#f0fdf4' : '#fefce8') : 'transparent',
        transition: 'background 0.1s',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px',
          background: sent ? '#dcfce7' : '#fef9c3',
          color: sent ? '#166534' : '#92400e',
          border: `1px solid ${sent ? '#86efac' : '#fde68a'}`,
          borderRadius: 12, fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sent ? '#16a34a' : '#d97706', display: 'inline-block' }} />
          {sent ? 'Đã nộp' : 'Chưa nộp'}
        </span>
        {hovered && <ChevronRight size={11} color="var(--color-text-muted)" />}
      </div>
      {sent && sub?.sent_by_name && (
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{sub.sent_by_name}</span>
      )}
      {sent && sub?.sent_at && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {new Date(sub.sent_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, priorityCfg, onNavigate, onComplete,
}: {
  task: Task;
  priorityCfg: { color: string; bg: string; border: string };
  onNavigate: () => void;
  onComplete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [completing, setCompleting] = useState(false);
  const overdueColor = '#b91c1c';
  const leftBorderColor = task.isOverdue ? overdueColor : priorityCfg.color;

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onComplete || completing) return;
    setCompleting(true);
    try { await onComplete(); } finally { setCompleting(false); }
  }

  return (
    <div
      onClick={task.type !== 'manual' ? onNavigate : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 14px',
        background: hovered ? priorityCfg.bg : 'var(--color-surface-elevated)',
        border: `1px solid ${hovered ? priorityCfg.border : 'var(--color-border)'}`,
        borderLeft: `3px solid ${leftBorderColor}`,
        borderRadius: 'var(--border-radius-erp)',
        cursor: task.type !== 'manual' ? 'pointer' : 'default',
        transition: 'all 0.1s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: priorityCfg.color,
            background: priorityCfg.bg,
            border: `1px solid ${priorityCfg.border}`,
            padding: '1px 5px', borderRadius: 2,
            textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
          }}>
            {TYPE_LABEL[task.type]}
          </span>
          {task.meta && (
            <span style={{
              fontSize: 'var(--fs-tiny)',
              color: task.isOverdue ? '#dc2626' : 'var(--color-text-muted)',
              fontWeight: task.isOverdue ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {task.meta}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </div>
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
          {task.description}
        </div>
      </div>

      {task.type === 'manual' && onComplete ? (
        <button
          onClick={handleComplete}
          disabled={completing}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px',
            background: hovered ? '#16a34a' : 'transparent',
            color: hovered ? '#fff' : '#16a34a',
            border: '1px solid #16a34a',
            borderRadius: 'var(--border-radius-erp)',
            fontSize: 'var(--fs-label)', fontWeight: 600,
            cursor: completing ? 'not-allowed' : 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap',
            opacity: completing ? 0.6 : 1,
            transition: 'all 0.1s ease',
          }}
        >
          <CheckCircle2 size={12} />
          Hoàn thành
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px',
            background: hovered ? priorityCfg.color : 'transparent',
            color: hovered ? '#fff' : priorityCfg.color,
            border: `1px solid ${priorityCfg.color}`,
            borderRadius: 'var(--border-radius-erp)',
            fontSize: 'var(--fs-label)', fontWeight: 600,
            cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            transition: 'all 0.1s ease',
          }}
        >
          Go
          <ArrowRight size={12} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

// ─── Task Kanban Card ──────────────────────────────────────────────────────────

function TaskKanbanCard({
  task, priorityCfg, onNavigate, onComplete,
}: {
  task: Task;
  priorityCfg: { color: string; bg: string; border: string };
  onNavigate: () => void;
  onComplete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [completing, setCompleting] = useState(false);
  const leftBorderColor = task.isOverdue ? '#b91c1c' : priorityCfg.color;

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onComplete || completing) return;
    setCompleting(true);
    try { await onComplete(); } finally { setCompleting(false); }
  }

  return (
    <div
      onClick={task.type !== 'manual' ? onNavigate : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: '12px 14px',
        background: hovered ? priorityCfg.bg : 'var(--color-surface-elevated)',
        border: `1px solid ${hovered ? priorityCfg.border : 'var(--color-border)'}`,
        borderLeft: `4px solid ${leftBorderColor}`,
        borderRadius: 8,
        cursor: task.type !== 'manual' ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        boxShadow: hovered ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: priorityCfg.color, background: priorityCfg.bg,
          border: `1px solid ${priorityCfg.border}`,
          padding: '2px 6px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {TYPE_LABEL[task.type]}
        </span>
        {task.meta && (
          <span
            style={{
              fontSize: 11,
              color: task.isOverdue ? '#dc2626' : 'var(--color-text-muted)',
              fontWeight: task.isOverdue ? 600 : 500,
              textAlign: 'right', flexShrink: 0, maxWidth: 100,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={task.meta}
          >
            {task.meta.split('·')[0].trim()}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4, lineHeight: 1.3 }}>
        {task.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.description}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        {task.type === 'manual' && onComplete ? (
          <button
            onClick={handleComplete}
            disabled={completing}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px',
              background: hovered ? '#16a34a' : 'transparent',
              color: hovered ? '#fff' : '#16a34a',
              border: '1px solid #16a34a',
              borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              cursor: completing ? 'not-allowed' : 'pointer',
              opacity: completing ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <CheckCircle2 size={12} />
            Hoàn thành
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: priorityCfg.color,
            fontSize: 11, fontWeight: 700,
            opacity: hovered ? 1 : 0.6,
            transition: 'all 0.15s',
          }}>
            GIAO VIỆC
            <ArrowRight size={13} strokeWidth={2.5} style={{ transform: hovered ? 'translateX(2px)' : 'none', transition: 'all 0.2s' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Completed Section ────────────────────────────────────────────────────────

function CompletedSection({ tasks }: { tasks: Task[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '6px 0',
          background: 'none', border: 'none', borderBottom: '2px solid #dcfce7',
          cursor: 'pointer', marginBottom: expanded ? 8 : 0,
        }}
      >
        <CheckCircle2 size={14} color="#16a34a" />
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Da xong ({tasks.length})
        </span>
        <ChevronRight
          size={14}
          color="#16a34a"
          style={{ marginLeft: 'auto', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => (
            <div
              key={task.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderLeft: '3px solid #86efac',
                borderRadius: 'var(--border-radius-erp)',
                opacity: 0.75,
              }}
            >
              <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </div>
                {task.description && (
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
                    {task.description}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 'var(--fs-tiny)', color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>Hoan thanh</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
