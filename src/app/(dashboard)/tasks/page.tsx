'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, ArrowRight, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle2, List, LayoutGrid
} from 'lucide-react';
import { fetchEventsFromDB, type EventItem } from '@/lib/events-data';
import { createClient } from '@/lib/supabase/client';

interface BudgetPlanSummary {
  showroom_code: string;
  month: number;
  year: number;
  approval_status: 'draft' | 'submitted' | 'approved';
}
import { generateIntelligentTasks, type Task, type SystemTaskType, type TaskPriority } from '@/lib/tasks-engine';
import { fetchManualTasks } from '@/lib/tasks-data';
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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlanSummary[]>([]);
  const [manualTasks, setManualTasks] = useState<Task[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) loadData(); }, [mounted]);

  async function loadData() {
    setLoading(true);
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
    } catch (err) {
      console.error('Tasks: load error', err);
    } finally {
      setLoading(false);
    }
  }

  const tasks = useMemo(() => {
    if (!mounted) return [];
    
    const systemTasks = generateIntelligentTasks(events, budgetPlans, {
       role: effectiveRole || '',
       showroom: profile?.showroom?.name || ''
    });

    return [...systemTasks, ...manualTasks];
  }, [events, budgetPlans, mounted, profile, effectiveRole, manualTasks]);

  const groups = useMemo<Record<TaskPriority, Task[]>>(() => ({
    urgent:     tasks.filter(t => t.priority === 'urgent'),
    this_week:  tasks.filter(t => t.priority === 'this_week'),
    this_month: tasks.filter(t => t.priority === 'this_month'),
  }), [tasks]);

  if (!mounted) return null;

  const urgentCount = groups.urgent.length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: viewMode === 'kanban' ? 1200 : 860, margin: '0 auto', transition: 'max-width 0.2s', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} color="var(--color-primary)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Việc cần làm</span>
          {!loading && tasks.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 20, height: 20, padding: '0 5px',
              background: urgentCount > 0 ? '#dc2626' : '#d97706',
              color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700,
            }}>
              {tasks.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 'var(--border-radius-erp)' }}>
            <button
               onClick={() => setViewMode('list')}
               style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, background: viewMode === 'list' ? '#fff' : 'transparent', borderRadius: 4, boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? '#0f172a' : '#64748b', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
            >
               <List size={14} /> Danh sách
            </button>
            <button
               onClick={() => setViewMode('kanban')}
               style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, background: viewMode === 'kanban' ? '#fff' : 'transparent', borderRadius: 4, boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'kanban' ? '#0f172a' : '#64748b', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
            >
               <LayoutGrid size={14} /> Bảng (Kanban)
            </button>
          </div>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
            {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadData} disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-erp)',
              fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.1s'
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Tải lại
          </button>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: '6px 14px',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--border-radius-erp)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 4px rgba(11, 87, 208, 0.2)'
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tạo việc
          </button>
        </div>
      </div>

      {/* ── Urgent Banner ──────────────────────────────────────────────────── */}
      {!loading && urgentCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--border-radius-erp)',
          borderLeft: '4px solid #dc2626',
        }}>
          <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: '#991b1b' }}>
            {urgentCount} việc khẩn cấp cần xử lý ngay
          </span>
        </div>
      )}

      {/* ── Summary Chips ───────────────────────────────────────────────────── */}
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

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
          Đang tải...
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
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

      {/* ── Task Groups ─────────────────────────────────────────────────────── */}
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
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Kanban View ─────────────────────────────────────────────────────── */}
      {!loading && tasks.length > 0 && viewMode === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'flex-start', flex: 1 }}>
          {(['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(priority => {
             const groupTasks = groups[priority];
             const cfg = PRIORITY_CONFIG[priority];
             const Icon = cfg.icon;
             return (
               <div key={priority} style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 'calc(100vh - 200px)' }}>
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
                        <TaskKanbanCard key={task.id} task={task} priorityCfg={cfg} onNavigate={() => router.push(task.deepLink)} />
                      ))
                    )}
                 </div>
               </div>
             )
          })}
        </div>
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

// ─── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, priorityCfg, onNavigate,
}: {
  task: Task;
  priorityCfg: { color: string; bg: string; border: string };
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 14px',
        background: hovered ? priorityCfg.bg : '#ffffff',
        border: `1px solid ${hovered ? priorityCfg.border : 'var(--color-border)'}`,
        borderLeft: `3px solid ${priorityCfg.color}`,
        borderRadius: 'var(--border-radius-erp)',
        cursor: 'pointer', transition: 'all 0.1s ease',
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
            <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    </div>
  );
}

// ─── Task Kanban Card ──────────────────────────────────────────────────────────

function TaskKanbanCard({
  task, priorityCfg, onNavigate,
}: {
  task: Task;
  priorityCfg: { color: string; bg: string; border: string };
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: '12px 14px',
        background: hovered ? priorityCfg.bg : '#ffffff',
        border: `1px solid ${hovered ? priorityCfg.border : 'var(--color-border)'}`,
        borderLeft: `4px solid ${priorityCfg.color}`,
        borderRadius: 8,
        cursor: 'pointer', transition: 'all 0.15s ease',
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
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500, textAlign: 'right', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.meta}>
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
      </div>
    </div>
  );
}
