'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare, ArrowRight, RefreshCw, AlertTriangle, Clock, Calendar,
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
  | 'digital_weekly'
  | 'submit_plan'
  | 'budget_overrun';

interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string;
  deepLink: string;
  meta?: string; // extra info (ngày, showroom...)
}

// ─── Priority Config ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  urgent:     { label: 'Khẩn cấp',   color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  this_week:  { label: 'Tuần này',   color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  this_month: { label: 'Tháng này',  color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
};

const TYPE_LABEL: Record<TaskType, string> = {
  report_event:    'Báo cáo sự kiện',
  confirm_event:   'Xác nhận lịch',
  upcoming_event:  'Sự kiện sắp tới',
  pre_event_check: 'Chuẩn bị sự kiện',
  digital_weekly:  'Nhập kết quả Digital',
  submit_plan:     'Lập kế hoạch',
  budget_overrun:  'Cảnh báo ngân sách',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse DD/MM/YYYY → Date object */
function parseDate(dStr: string): Date | null {
  if (!dStr) return null;
  const parts = dStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

/** Diff ngày từ today (dương = tương lai, âm = quá khứ) */
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

// ─── Task Generation Algorithm ─────────────────────────────────────────────────

function generateTasks(events: EventItem[], budgetPlans: BudgetPlanData[]): Task[] {
  const tasks: Task[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── 1. Event-based tasks ───────────────────────────────────────────────────
  for (const ev of events) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    // report_event: Sự kiện đã qua 1-3 ngày, chưa có budgetSpent
    if (diff >= -3 && diff < 0 && !ev.budgetSpent) {
      tasks.push({
        id: `report_event_${ev.id}`,
        type: 'report_event',
        priority: 'urgent',
        title: `Nhập kết quả: ${ev.name}`,
        description: `Sự kiện tại ${ev.showroom} đã kết thúc ${Math.abs(diff)} ngày trước, chưa có báo cáo thực hiện.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // pre_event_check: còn 1 ngày
    if (diff === 1) {
      tasks.push({
        id: `pre_event_${ev.id}`,
        type: 'pre_event_check',
        priority: 'urgent',
        title: `Chuẩn bị cuối: ${ev.name}`,
        description: `Sự kiện diễn ra ngày mai. Kiểm tra nhân sự, vật tư, ngân sách lần cuối.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // confirm_event: còn 2-7 ngày (mở rộng để không bỏ sót ngày 2)
    if (diff >= 2 && diff <= 7) {
      tasks.push({
        id: `confirm_event_${ev.id}`,
        type: 'confirm_event',
        priority: 'this_week',
        title: `Xác nhận lịch: ${ev.name}`,
        description: `Sự kiện còn ${diff} ngày. Xác nhận không có thay đổi lịch trước khi triển khai chuẩn bị.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // upcoming_event: còn 8-14 ngày — nhắc chuẩn bị sớm
    if (diff >= 8 && diff <= 14) {
      tasks.push({
        id: `upcoming_event_${ev.id}`,
        type: 'upcoming_event',
        priority: 'this_month',
        title: `Chuẩn bị: ${ev.name}`,
        description: `Sự kiện còn ${diff} ngày. Kiểm tra kế hoạch nhân sự, vật tư và ngân sách.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }
  }

  // ── 2. Digital weekly: Thứ Hai hàng tuần ──────────────────────────────────
  const dayOfWeek = today.getDay(); // 0=CN, 1=T2...
  if (dayOfWeek === 1) {
    tasks.push({
      id: 'digital_weekly',
      type: 'digital_weekly',
      priority: 'this_week',
      title: 'Nhập kết quả Digital tuần qua',
      description: 'Hàng tuần: cập nhật số liệu Google Ads, Facebook Ads từ agency vào trang Nhập thực hiện.',
      deepLink: '/actual',
      meta: `Hôm nay ${formatDateVN(today)}`,
    });
  }

  // ── 3. Submit plan: ngày 20-25 tháng, tháng sau chưa có kế hoạch ──────────
  const dayOfMonth = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  if (dayOfMonth >= 20 && dayOfMonth <= 25) {
    const hasNextMonthPlan = budgetPlans.some(p => p.month === nextMonth);
    if (!hasNextMonthPlan) {
      tasks.push({
        id: 'submit_plan_next_month',
        type: 'submit_plan',
        priority: 'this_week',
        title: `Lập kế hoạch Tháng ${nextMonth}`,
        description: `Đã đến cuối tháng. Kế hoạch ngân sách & KPI cho Tháng ${nextMonth} chưa được lập.`,
        deepLink: `/planning?month=${nextMonth}`,
        meta: `Deadline: ${formatDateVN(new Date(today.getFullYear(), currentMonth - 1, 25))}`,
      });
    }
  }

  // ── 4. Budget overrun: tổng chi > 95% ngân sách tháng hiện tại ────────────
  const currentPlan = budgetPlans.find(p => p.month === currentMonth);
  if (currentPlan?.payload) {
    const totalPayload = Object.values(currentPlan.payload as Record<string, number>)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .reduce((s, v) => s + v, 0);

    // Lấy approved budget (hoặc tổng payload nếu chưa có field riêng)
    // Ngưỡng cảnh báo: nếu payload tổng > 95% của budget tháng đang xét
    // Hiện tại dùng heuristic: nếu tổng payload > 500tr thì cảnh báo (thay sau khi có approved_budget)
    if (currentPlan.approval_status === 'approved' && totalPayload > 0) {
      // Khi đã approved, cảnh báo nếu actual > 95% plan (cần actual data — placeholder)
      // TODO: So sánh với actual khi tích hợp Sprint 3
    }
  }

  // ─ Sắp xếp: urgent trước, sau đó theo title ──────────────────────────────
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadData();
  }, [mounted]);

  async function loadData() {
    setLoading(true);
    try {
      const [eventsData, plansData] = await Promise.all([
        fetchEventsFromDB(),
        fetchAllBudgetPlans(),
      ]);
      // Flatten events from all months
      const allEvents = Object.values(eventsData).flat();
      setEvents(allEvents);
      setBudgetPlans(plansData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Tasks: load error', err);
    } finally {
      setLoading(false);
    }
  }

  const tasks = useMemo(() => {
    if (!mounted) return [];
    return generateTasks(events, budgetPlans);
  }, [events, budgetPlans, mounted]);

  const groups = useMemo<Record<TaskPriority, Task[]>>(() => ({
    urgent:     tasks.filter(t => t.priority === 'urgent'),
    this_week:  tasks.filter(t => t.priority === 'this_week'),
    this_month: tasks.filter(t => t.priority === 'this_month'),
  }), [tasks]);

  if (!mounted) return null;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckSquare size={20} color="var(--color-primary)" />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.01em' }}>
              Việc cần làm
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 30px', fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
            Danh sách được tổng hợp tự động từ sự kiện và kế hoạch ngân sách
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)' }}>
            Cập nhật: {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-erp)',
              fontSize: 'var(--fs-body)',
              color: 'var(--color-text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Tải lại
          </button>
        </div>
      </div>

      {/* ── Summary Strip ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28,
      }}>
        {(['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(p => {
          const cfg = PRIORITY_CONFIG[p];
          const count = groups[p].length;
          return (
            <div key={p} style={{
              padding: '14px 18px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 'var(--border-radius-erp)',
            }}>
              <div style={{ fontSize: 'var(--fs-label)', color: cfg.color, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
                {count}
              </div>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {count === 0 ? 'Không có việc' : count === 1 ? 'việc cần làm' : 'việc cần làm'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
          Đang tải dữ liệu...
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && tasks.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--border-radius-erp)',
          color: 'var(--color-text-muted)',
        }}>
          <CheckSquare size={32} color="var(--color-border)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Tất cả đã hoàn thành</div>
          <div style={{ fontSize: 'var(--fs-body)' }}>Hiện không có việc cần làm nào được nhắc nhở.</div>
        </div>
      )}

      {/* ── Task Groups ─────────────────────────────────────────────────────── */}
      {!loading && (['urgent', 'this_week', 'this_month'] as TaskPriority[]).map(priority => {
        const groupTasks = groups[priority];
        if (groupTasks.length === 0) return null;
        const cfg = PRIORITY_CONFIG[priority];

        return (
          <div key={priority} style={{ marginBottom: 28 }}>
            {/* Group Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: `2px solid ${cfg.border}`,
            }}>
              {priority === 'urgent' && <AlertTriangle size={15} color={cfg.color} />}
              {priority === 'this_week' && <Clock size={15} color={cfg.color} />}
              {priority === 'this_month' && <Calendar size={15} color={cfg.color} />}
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {cfg.label}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20,
                background: cfg.color, color: '#fff',
                borderRadius: '50%', fontSize: 10, fontWeight: 700,
              }}>
                {groupTasks.length}
              </span>
            </div>

            {/* Task Cards */}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Task Card Component ───────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  priorityCfg: { color: string; bg: string; border: string };
  onNavigate: () => void;
}

function TaskCard({ task, priorityCfg, onNavigate }: TaskCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 16px',
        background: hovered ? priorityCfg.bg : '#ffffff',
        border: `1px solid ${hovered ? priorityCfg.border : 'var(--color-border)'}`,
        borderRadius: 'var(--border-radius-erp)',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        borderLeft: `4px solid ${priorityCfg.color}`,
      }}
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 'var(--fs-tiny)', fontWeight: 600,
            color: priorityCfg.color,
            background: priorityCfg.bg,
            border: `1px solid ${priorityCfg.border}`,
            padding: '1px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {TYPE_LABEL[task.type]}
          </span>
          {task.meta && (
            <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--color-text-muted)' }}>
              {task.meta}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </div>
        <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {task.description}
        </div>
      </div>

      {/* Action */}
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px',
          background: priorityCfg.color,
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--border-radius-erp)',
          fontSize: 'var(--fs-label)', fontWeight: 600,
          cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        Xem ngay
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
