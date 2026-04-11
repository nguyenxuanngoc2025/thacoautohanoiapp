'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowRight, X } from 'lucide-react';
import { fetchEventsFromDB } from '@/lib/events-data';
import { fetchAllBudgetPlans, type BudgetPlanData } from '@/lib/budget-data';
import { type EventItem } from '@/lib/events-data';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TaskPriority = 'urgent' | 'this_week' | 'this_month';

interface Notification {
  id: string;
  priority: TaskPriority;
  title: string;
  deepLink: string;
  timeLabel: string;
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent:     '#dc2626',
  this_week:  '#d97706',
  this_month: '#2563eb',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent:     'Khẩn cấp',
  this_week:  'Tuần này',
  this_month: 'Tháng này',
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

// ─── Notification Generation Algorithm ────────────────────────────────────────

function generateNotifications(events: EventItem[], budgetPlans: BudgetPlanData[]): Notification[] {
  const items: Notification[] = [];
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const dayOfMonth = today.getDate();
  const dayOfWeek = today.getDay(); // 0=CN, 1=T2...

  for (const ev of events) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    // Sự kiện đã qua 1-3 ngày, chưa có báo cáo ngân sách
    if (diff >= -3 && diff < 0 && !ev.budgetSpent) {
      items.push({
        id: `notif_report_${ev.id}`,
        priority: 'urgent',
        title: `Chưa báo cáo: ${ev.name}`,
        deepLink: `/events?id=${ev.id}`,
        timeLabel: `${Math.abs(diff)} ngày trước`,
      });
    }

    // Sự kiện diễn ra ngày mai
    if (diff === 1) {
      items.push({
        id: `notif_pre_${ev.id}`,
        priority: 'urgent',
        title: `Kiểm tra chuẩn bị: ${ev.name}`,
        deepLink: `/events?id=${ev.id}`,
        timeLabel: 'Ngày mai',
      });
    }

    // Sự kiện còn 2-7 ngày — xác nhận lịch (mở rộng để không bỏ sót ngày 2)
    if (diff >= 2 && diff <= 7) {
      items.push({
        id: `notif_confirm_${ev.id}`,
        priority: 'this_week',
        title: `Xác nhận lịch: ${ev.name}`,
        deepLink: `/events?id=${ev.id}`,
        timeLabel: `Còn ${diff} ngày`,
      });
    }

    // Sự kiện còn 8-14 ngày — nhắc chuẩn bị sớm
    if (diff >= 8 && diff <= 14) {
      items.push({
        id: `notif_upcoming_${ev.id}`,
        priority: 'this_month',
        title: `Sắp tới: ${ev.name}`,
        deepLink: `/events?id=${ev.id}`,
        timeLabel: `Còn ${diff} ngày`,
      });
    }
  }

  // Thứ Hai: nhắc nhập kết quả Digital tuần qua
  if (dayOfWeek === 1) {
    items.push({
      id: 'notif_digital_weekly',
      priority: 'this_week',
      title: 'Nhập kết quả Digital tuần qua',
      deepLink: '/actual',
      timeLabel: 'Hôm nay',
    });
  }

  // Ngày 20-25: nhắc lập kế hoạch tháng sau nếu chưa có
  if (dayOfMonth >= 20 && dayOfMonth <= 25) {
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const hasNextMonthPlan = budgetPlans.some(p => p.month === nextMonth);
    if (!hasNextMonthPlan) {
      items.push({
        id: 'notif_submit_plan',
        priority: 'this_week',
        title: `Lập kế hoạch Tháng ${nextMonth}`,
        deepLink: `/planning?month=${nextMonth}`,
        timeLabel: `Ngày ${dayOfMonth} tháng này`,
      });
    }
  }

  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, this_week: 1, this_month: 2 };
  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return items.slice(0, 10);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const [eventsData, plansData] = await Promise.all([
        fetchEventsFromDB(),
        fetchAllBudgetPlans(),
      ]);
      const allEvents = Object.values(eventsData).flat();
      setNotifications(generateNotifications(allEvents, plansData));
    } catch {
      // silent fail
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const urgentCount = notifications.filter(n => n.priority === 'urgent').length;
  const totalCount = notifications.length;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        title="Thông báo"
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34,
          background: open ? 'var(--color-bg-hover)' : 'transparent',
          border: '1px solid ' + (open ? 'var(--color-border)' : 'transparent'),
          borderRadius: 'var(--border-radius-erp)',
          cursor: 'pointer',
          color: totalCount > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
          transition: 'all 0.12s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }
        }}
      >
        <Bell size={16} />
        {loaded && totalCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16,
            background: urgentCount > 0 ? '#dc2626' : '#d97706',
            color: '#fff',
            borderRadius: 8, fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            border: '1.5px solid #fff',
          }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            width: 340,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            zIndex: 500,
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border)',
            background: '#f8fafc',
          }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--color-text)' }}>
              Thông báo
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {totalCount > 0 && (
                <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--color-text-muted)' }}>
                  {totalCount} việc cần làm
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
                Không có thông báo nào
              </div>
            ) : (
              notifications.map((n, idx) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  isLast={idx === notifications.length - 1}
                  onNavigate={() => {
                    setOpen(false);
                    router.push(n.deepLink);
                  }}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 14px' }}>
              <button
                onClick={() => { setOpen(false); router.push('/tasks'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-label)', color: 'var(--color-primary)', fontWeight: 600,
                  padding: 0,
                }}
              >
                Xem tất cả việc cần làm
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification Item ─────────────────────────────────────────────────────────

function NotificationItem({
  notification: n,
  isLast,
  onNavigate,
}: {
  notification: Notification;
  isLast: boolean;
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = PRIORITY_COLOR[n.priority];

  return (
    <div
      onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px',
        background: hovered ? '#f8fafc' : '#fff',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-light)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-tiny)', color, fontWeight: 600 }}>{PRIORITY_LABEL[n.priority]}</span>
          <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--color-text-muted)' }}>{n.timeLabel}</span>
        </div>
      </div>
      <ArrowRight size={12} color={hovered ? color : 'var(--color-text-muted)'} style={{ flexShrink: 0, marginTop: 4, transition: 'color 0.1s' }} />
    </div>
  );
}
