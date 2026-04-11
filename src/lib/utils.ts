import { type KPIMetrics } from '@/types/database';

/**
 * Calculate KPI metrics from raw budget entry data
 */
export function calculateKPIs(budget: number, khqt: number, gdtd: number, khd: number): KPIMetrics {
  return {
    budget_amount: budget,
    khqt,
    gdtd,
    khd,
    tlcd_khqt_gdtd: khqt > 0 ? Math.round((gdtd / khqt) * 1000) / 10 : null,
    tlcd_gdtd_khd: gdtd > 0 ? Math.round((khd / gdtd) * 1000) / 10 : null,
    tlcd_khqt_khd: khqt > 0 ? Math.round((khd / khqt) * 1000) / 10 : null,
    cost_per_lead: khqt > 0 ? Math.round(budget / khqt) : null,
    cost_per_acquisition: khd > 0 ? Math.round(budget / khd) : null,
  };
}

/**
 * Format number as Vietnamese currency (triệu VND)
 */
export function formatBudget(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)} tỷ`;
  }
  if (amount >= 1) {
    return `${amount.toFixed(1)} tr`;
  }
  return `${(amount * 1000).toFixed(0)}k`;
}

/**
 * Format number with dot separator (Vietnamese style)
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null): string {
  if (value === null || isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

/**
 * Calculate budget utilization color
 */
export function getBudgetColor(actual: number, plan: number): string {
  if (plan === 0) return 'text-zinc-400';
  const pct = (actual / plan) * 100;
  if (pct > 100) return 'text-red-500';
  if (pct > 80) return 'text-amber-500';
  return 'text-emerald-500';
}

/**
 * Calculate budget utilization percentage
 */
export function getBudgetUtilization(actual: number, plan: number): number {
  if (plan === 0) return 0;
  return Math.round((actual / plan) * 1000) / 10;
}

/**
 * Get delta and trend between two values
 */
export function getDelta(current: number, previous: number): { value: number; percent: number; trend: 'up' | 'down' | 'flat' } {
  const value = current - previous;
  const percent = previous > 0 ? Math.round((value / previous) * 1000) / 10 : 0;
  const trend = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return { value, percent, trend };
}

/**
 * Get week number for a date (Mon-Sun weeks)
 */
export function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  // Adjust to make Monday the first day of the week
  const firstMonday = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  const diff = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
  firstMonday.setDate(firstDay.getDate() + diff);
  
  if (date < firstMonday) return 1;
  
  const daysSinceFirstMonday = Math.floor((date.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(daysSinceFirstMonday / 7) + (diff > 0 ? 2 : 1);
}

/**
 * cn() utility for conditional class names
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
