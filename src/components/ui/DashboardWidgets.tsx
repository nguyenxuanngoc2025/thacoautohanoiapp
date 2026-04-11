'use client';

import { formatBudget, formatNumber, formatPercent, cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  UserCheck,
  FileSignature,
  Target,
  Zap,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'cyan';
}

export function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
  const colorMap = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20',
    violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
  };

  const iconColorMap = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className={cn(
      'stat-card bg-gradient-to-br',
      colorMap[color]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg bg-[--color-bg]/60', iconColorMap[color])}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            trend.value > 0 ? 'text-emerald-400 bg-emerald-500/10' :
            trend.value < 0 ? 'text-red-400 bg-red-500/10' :
            'text-zinc-400 bg-zinc-500/10'
          )}>
            {trend.value > 0 ? <TrendingUp size={12} /> : 
             trend.value < 0 ? <TrendingDown size={12} /> : 
             <Minus size={12} />}
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>
      <p className="text-[11px] text-[--color-text-muted] uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-bold text-[--color-text]">{value}</p>
      {subtitle && <p className="text-xs text-[--color-text-dim] mt-1">{subtitle}</p>}
    </div>
  );
}

interface BudgetProgressProps {
  label: string;
  plan: number;
  actual: number;
  unit?: string;
}

export function BudgetProgress({ label, plan, actual, unit = 'tr' }: BudgetProgressProps) {
  const pct = plan > 0 ? Math.min((actual / plan) * 100, 120) : 0;
  const displayPct = plan > 0 ? (actual / plan) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[--color-text-muted]">{label}</span>
        <span className="text-xs font-medium text-[--color-text]">
          {formatNumber(actual)} / {formatNumber(plan)} {unit}
        </span>
      </div>
      <div className="budget-bar">
        <div
          className={cn(
            'budget-bar-fill',
            displayPct > 100 ? 'bg-red-500' :
            displayPct > 80 ? 'bg-amber-500' :
            'bg-emerald-500'
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={cn(
          'text-[10px] font-medium',
          displayPct > 100 ? 'text-red-400' :
          displayPct > 80 ? 'text-amber-400' :
          'text-emerald-400'
        )}>
          {displayPct.toFixed(1)}%
        </span>
        <span className="text-[10px] text-[--color-text-dim]">
          Còn lại: {formatNumber(Math.max(plan - actual, 0))} {unit}
        </span>
      </div>
    </div>
  );
}

interface FunnelProps {
  khqt: number;
  gdtd: number;
  khd: number;
  khqtPrev?: number;
  gdtdPrev?: number;
  khdPrev?: number;
}

export function FunnelChart({ khqt, gdtd, khd, khqtPrev, gdtdPrev, khdPrev }: FunnelProps) {
  const convKhqtGdtd = khqt > 0 ? ((gdtd / khqt) * 100).toFixed(1) : '—';
  const convGdtdKhd = gdtd > 0 ? ((khd / gdtd) * 100).toFixed(1) : '—';
  const convTotal = khqt > 0 ? ((khd / khqt) * 100).toFixed(1) : '—';

  const steps = [
    { 
      label: 'KHQT', 
      sublabel: 'Khách hàng quan tâm',
      value: khqt, 
      prev: khqtPrev,
      color: 'bg-blue-500', 
      width: '100%',
      icon: <Users size={16} />,
    },
    { 
      label: 'GDTD', 
      sublabel: 'Giao dịch thử/đặt',
      value: gdtd, 
      prev: gdtdPrev,
      color: 'bg-amber-500', 
      width: khqt > 0 ? `${Math.max((gdtd / khqt) * 100, 20)}%` : '50%',
      icon: <UserCheck size={16} />,
    },
    { 
      label: 'KHĐ', 
      sublabel: 'Ký hợp đồng',
      value: khd, 
      prev: khdPrev,
      color: 'bg-emerald-500', 
      width: khqt > 0 ? `${Math.max((khd / khqt) * 100, 15)}%` : '30%',
      icon: <FileSignature size={16} />,
    },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-[--color-text] mb-4 flex items-center gap-2">
        <Target size={16} className="text-blue-400" />
        Phễu chuyển đổi
      </h3>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('p-1 rounded', step.color, 'bg-opacity-20 text-white')}>
                  {step.icon}
                </span>
                <div>
                  <span className="text-xs font-medium text-[--color-text]">{step.label}</span>
                  <span className="text-[10px] text-[--color-text-dim] ml-2">{step.sublabel}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[--color-text]">{formatNumber(step.value)}</span>
                {step.prev !== undefined && step.prev > 0 && (
                  <span className={cn(
                    'text-[10px] ml-2',
                    step.value >= step.prev ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {step.value >= step.prev ? '↑' : '↓'}
                    {Math.abs(((step.value - step.prev) / step.prev) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 rounded bg-[--color-bg] overflow-hidden">
              <div
                className={cn('h-full rounded transition-all duration-700', step.color)}
                style={{ width: step.width }}
              />
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center">
                <span className="text-[10px] text-[--color-text-dim] bg-[--color-bg-card] px-2 py-0.5 rounded">
                  <Zap size={10} className="inline mr-1 text-amber-400" />
                  Chuyển đổi: {i === 0 ? convKhqtGdtd : convGdtdKhd}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[--color-border]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[--color-text-muted]">Tỷ lệ tổng KHQT → KHĐ</span>
          <span className="text-sm font-bold text-emerald-400">{convTotal}%</span>
        </div>
      </div>
    </div>
  );
}
