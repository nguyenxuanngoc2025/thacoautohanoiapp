import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0';
  return val.toLocaleString('vi-VN');
}

export function formatBudget(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0';
  return val.toLocaleString('vi-VN');
}

export function formatPercent(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '0%';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0%';
  return `${val.toFixed(1)}%`;
}
