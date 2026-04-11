'use client';

import { Calendar, Bell, Search } from 'lucide-react';
import { MONTHS } from '@/lib/constants';

interface HeaderProps {
  title: string;
  subtitle?: string;
  year?: number;
  month?: number;
  onPeriodChange?: (year: number, month: number) => void;
}

export default function Header({ title, subtitle, year = 2026, month = 4, onPeriodChange }: HeaderProps) {
  return (
    <header className="h-16 border-b border-[--color-border] bg-[--color-bg-card]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h2 className="text-lg font-semibold text-[--color-text]">{title}</h2>
        {subtitle && <p className="text-xs text-[--color-text-dim]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-dim]" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="pl-9 pr-4 py-1.5 rounded-lg bg-[--color-bg] border border-[--color-border] text-xs text-[--color-text] placeholder:text-[--color-text-dim] focus:outline-none focus:border-blue-500 w-48 transition-colors"
          />
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-[--color-bg] rounded-lg px-3 py-1.5 border border-[--color-border]">
          <Calendar size={14} className="text-[--color-text-dim]" />
          <select
            value={month}
            onChange={(e) => onPeriodChange?.(year, parseInt(e.target.value))}
            className="bg-transparent text-xs text-[--color-text] border-none outline-none cursor-pointer"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[--color-bg-card]">
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => onPeriodChange?.(parseInt(e.target.value), month)}
            className="bg-transparent text-xs text-[--color-text] border-none outline-none cursor-pointer"
          >
            <option value={2025} className="bg-[--color-bg-card]">2025</option>
            <option value={2026} className="bg-[--color-bg-card]">2026</option>
            <option value={2027} className="bg-[--color-bg-card]">2027</option>
          </select>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-[--color-bg-hover] transition-colors">
          <Bell size={16} className="text-[--color-text-muted]" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}
