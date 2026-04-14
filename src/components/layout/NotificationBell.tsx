'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { fetchEventsFromDB } from '@/lib/events-data';
import { fetchAllBudgetPlans, type BudgetPlanData } from '@/lib/budget-data';
import { type EventItem } from '@/lib/events-data';

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

// ─── Count urgent tasks ────────────────────────────────────────────────────────

function countTasks(events: EventItem[], budgetPlans: BudgetPlanData[]): { urgent: number; total: number } {
  let urgent = 0, total = 0;
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const dayOfMonth = today.getDate();

  for (const ev of events) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    if (diff >= -3 && diff < 0 && !ev.budgetSpent) { urgent++; total++; }
    else if (diff === 1) { urgent++; total++; }
    else if (diff >= 2 && diff <= 7) { total++; }
    else if (diff >= 8 && diff <= 14) { total++; }
  }

  if (dayOfMonth >= 20 && dayOfMonth <= 25) {
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    if (!budgetPlans.some(p => p.month === nextMonth)) total++;
  }

  return { urgent, total };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const router = useRouter();
  const [counts, setCounts] = useState<{ urgent: number; total: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [eventsData, plansData] = await Promise.all([
        fetchEventsFromDB(),
        fetchAllBudgetPlans(),
      ]);
      const allEvents = Object.values(eventsData).flat();
      setCounts(countTasks(allEvents, plansData));
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const urgent = counts?.urgent ?? 0;
  const total = counts?.total ?? 0;

  return (
    <button
      onClick={() => router.push('/tasks')}
      title={total > 0 ? `${total} việc cần làm${urgent > 0 ? ` (${urgent} khẩn cấp)` : ''}` : 'Việc cần làm'}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--border-radius-erp)',
        cursor: 'pointer',
        color: total > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
      }}
    >
      <Bell size={16} />
      {counts !== null && total > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          minWidth: 16, height: 16,
          background: urgent > 0 ? '#dc2626' : '#d97706',
          color: '#fff',
          borderRadius: 8, fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px',
          border: '1.5px solid #fff',
        }}>
          {total > 9 ? '9+' : total}
        </span>
      )}
    </button>
  );
}
