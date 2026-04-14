'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, ArrowRight, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle2,
} from 'lucide-react';
import { fetchEventsFromDB, type EventItem } from '@/lib/events-data';
import { fetchAllBudgetPlans, type BudgetPlanData } from '@/lib/budget-data';

// ─── Task Types ────────────────────────────────────────────────────────────────

type TaskPriority = 'urgent' | 'this_week' | 'this_month';
type TaskType =
  | 'report_event'
  | 'confirm_event'
  | 'upcoming_event'
  | 'pre_event_check'
  | 'submit_plan'
  | 'budget_overrun';

interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string;
  deepLink: string;
  meta?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  urgent:     { label: 'Khẩn cấp',  icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  this_week:  { label: 'Tuần này',  icon: Clock,         color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  this_month: { label: 'Tháng này', icon: Calendar,      color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
};

const TYPE_LABEL: Record<TaskType, string> = {
  report_event:    'Báo cáo sự kiện',
  confirm_event:   'Xác nhận lịch',
  upcoming_event:  'Sự kiện sắp tới',
  pre_event_check: 'Chuẩn bị sự kiện',
  submit_plan:     'Lập kế hoạch',
  budget_overrun:  'Cảnh báo ngân sách',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(dStr: string): Date | null {
  if (!dStr) return null;
  const parts = dStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

function daysDiff(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateVN(date: Date): string {
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

// ─── Task Generation ───────────────────────────────────────────────────────────

function generateTasks(events: EventItem[], budgetPlans: BudgetPlanData[]): Task[] {
  const tasks: Task[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const ev of events) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    if (diff >= -3 && diff < 0 && !ev.budgetSpent) {
      tasks.push({
        id: `report_event_${ev.id}`, type: 'report_event', priority: 'urgent',
        title: `Nhập kết quả: ${ev.name}`,
        description: `Sự kiện tại ${ev.showroom} đã kết thúc ${Math.abs(diff)} ngày trước, chưa có báo cáo thực hiện.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    if (diff === 1) {
      tasks.push({
        id: `pre_event_${ev.id}`, type: 'pre_event_check', priority: 'urgent',
        title: `Chuẩn bị cuối: ${ev.name}`,
        description: `Sự kiện diễn ra ngày mai. Kiểm tra nhân sự, vật tư, ngân sách lần cuối.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    if (diff >= 2 && diff <= 7) {
      tasks.push({
        id: `confirm_event_${ev.id}`, type: 'confirm_event', priority: 'this_week',
        title: `Xác nhận lịch: ${ev.name}`,
        description: `Còn ${diff} ngày. Xác nhận không có thay đổi lịch trước khi chuẩn bị.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    if (diff >= 8 && diff <= 14) {
      tasks.push({
        id: `upcoming_event_${ev.id}`, type: 'upcoming_event', priority: 'this_month',
        title: `Chuẩn bị: ${ev.name}`,
        description: `Còn ${diff} ngày. Kiểm tra kế hoạch nhân sự, vật tư và ngân sách.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }
  }

  const dayOfMonth = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  if (dayOfMonth >= 20 && dayOfMonth <= 25) {
    if (!budgetPlans.some(p => p.month === nextMonth)) {
      tasks.push({
        id: 'submit_plan_next_month', type: 'submit_plan', priority: 'this_week',
        title: `Lập kế hoạch Tháng ${nextMonth}`,
        description: `Đã đến cuối tháng. Kế hoạch ngân sách & KPI cho Tháng ${nextMonth} chưa được lập.`,
        deepLink: `/planning?month=${nextMonth}`,
        meta: `Deadline: ${formatDateVN(new Date(today.getFullYear(), currentMonth - 1, 25))}`,
      });
    }
  }

  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, this_week: 1, this_month: 2 };
  tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title, 'vi'));

  return tasks;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlanData[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) loadData(); }, [mounted]);

  async function loadData() {
    setLoading(true);
    try {
      const [eventsData, plansData] = await Promise.all([
        fetchEventsFromDB(),
        fetchAllBudgetPlans(),
      ]);
      setEvents(Object.values(eventsData).flat());
      setBudgetPlans(plansData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Tasks: load error', err);
    } finally {
      setLoading(false);
    }
  }

  const tasks = useMemo(() => mounted ? generateTasks(events, budgetPlans) : [], [events, budgetPlans, mounted]);
  const groups = useMemo<Record<TaskPriority, Task[]>>(() => ({
    urgent:     tasks.filter(t => t.priority === 'urgent'),
    this_week:  tasks.filter(t => t.priority === 'this_week'),
    this_month: tasks.filter(t => t.priority === 'this_month'),
  }), [tasks]);

  if (!mounted) return null;

  const urgentCount = groups.urgent.length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 860, margin: '0 auto' }}>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
            {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadData} disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-erp)',
              fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Tải lại
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
      {!loading && (['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(priority => {
        const groupTasks = groups[priority];
        if (groupTasks.length === 0) return null;
        const cfg = PRIORITY_CONFIG[priority];
        const Icon = cfg.icon;

        return (
          <div key={priority} style={{ marginBottom: 24 }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        Xem ngay
        <ArrowRight size={11} />
      </button>
    </div>
  );
}
