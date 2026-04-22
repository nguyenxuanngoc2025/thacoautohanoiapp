'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MONTHS } from '@/lib/constants';

interface PageHeaderProps {
  title?: string;
  year?: number;
  month?: number;
  viewMode?: 'month' | 'quarter' | 'year';
  onPeriodChange?: (year: number, month: number) => void;
  onViewModeChange?: (mode: 'month' | 'quarter' | 'year') => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  year = 2026,
  month = 4,
  viewMode = 'month',
  onPeriodChange,
  onViewModeChange,
  filters,
  actions,
}: PageHeaderProps) {
  const QUARTERS = [
    { value: 1, label: 'Q1' },
    { value: 2, label: 'Q2' },
    { value: 3, label: 'Q3' },
    { value: 4, label: 'Q4' },
  ];

  const currentQuarter = Math.ceil(month / 3);

  const periodControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="period-tabs">
        {(['month', 'quarter', 'year'] as const).map((mode) => (
        <button
          key={mode}
          className={`period-tab${viewMode === mode ? ' active' : ''}`}
          onClick={() => onViewModeChange?.(mode)}
        >
          {mode === 'month' ? 'Tháng' : mode === 'quarter' ? 'Quý' : 'Năm'}
        </button>
      ))}
      </div>

      {/* Month quick-select */}
      {viewMode === 'month' && (
        <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {MONTHS.map((m) => (
            <button
              key={m.value}
              onClick={() => onPeriodChange?.(year, m.value)}
              style={{
                width: 24,
                height: 24,
                border: '1px solid',
                borderColor: month === m.value ? 'var(--color-brand)' : 'var(--color-border)',
                background: month === m.value ? 'var(--color-brand)' : '#fff',
                color: month === m.value ? 'white' : 'var(--color-text-muted)',
                fontSize: 'var(--fs-label)',
                fontWeight: month === m.value ? 700 : 400,
                cursor: 'pointer',
                borderRadius: 'var(--border-radius-erp)',
              }}
            >
              {m.value}
            </button>
          ))}
        </div>
      )}

      {/* Quarter selection */}
      {viewMode === 'quarter' && (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {QUARTERS.map((q) => (
            <button
              key={q.value}
              onClick={() => onPeriodChange?.(year, Math.min(q.value * 3, 12))}
              style={{
                padding: '2px 10px',
                border: '1px solid',
                borderColor: currentQuarter === q.value ? 'var(--color-brand)' : 'var(--color-border)',
                background: currentQuarter === q.value ? 'var(--color-brand)' : '#fff',
                color: currentQuarter === q.value ? 'white' : 'var(--color-text-muted)',
                fontSize: 'var(--fs-table)',
                fontWeight: currentQuarter === q.value ? 700 : 400,
                cursor: 'pointer',
                borderRadius: 'var(--border-radius-erp)',
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Year selector */}
      <select
        value={year}
        onChange={(e) => onPeriodChange?.(parseInt(e.target.value), month)}
        className="form-select"
        style={{ minWidth: 70 }}
      >
        <option value={2024}>2024</option>
        <option value={2025}>2025</option>
        <option value={2026}>2026</option>
        <option value={2027}>2027</option>
      </select>
    </div>
  );

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'nowrap',
        flexShrink: 0,
        height: 36,
        minHeight: 36,
        overflow: 'visible',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Render inline instead of topbar portal */}
      {periodControls}

      {/* Filters (Showroom, Brand, etc) — nowrap single line */}
      {filters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {filters}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Custom actions */}
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
