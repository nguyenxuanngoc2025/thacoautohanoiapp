'use client';

/**
 * StatusBar — Thanh trạng thái chân trang (IDE-style)
 *
 * Chỉ hiển thị với Super Admin.
 * Cho phép chuyển đổi ngữ cảnh Công ty (Unit) toàn cục.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronUp, Globe, CheckCircle2 } from 'lucide-react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { type Unit } from '@/types/database';

export default function StatusBar() {
  const { isSuperAdmin, profile } = useAuth();
  const { activeUnitId, activeUnit, availableUnits, canSwitchUnits, setActiveUnitId } = useUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Chỉ render cho super_admin
  if (!isSuperAdmin) return null;

  const displayName = activeUnitId === 'all'
    ? 'TOÀN HỆ THỐNG'
    : (activeUnit?.name ?? 'Đang tải...');

  const displayCode = activeUnitId === 'all'
    ? 'ALL'
    : (activeUnit?.code ?? '—');

  return (
    <div
      style={{
        height: 28,
        background: '#0f172a',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
        zIndex: 500,
        userSelect: 'none',
      }}
    >
      {/* ── Unit Switcher ── */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => canSwitchUnits && setOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: open ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: 'none',
            borderRadius: 3,
            padding: '2px 7px',
            cursor: canSwitchUnits ? 'pointer' : 'default',
            color: activeUnitId === 'all' ? '#60a5fa' : '#a3e635',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            transition: 'background 0.15s',
            height: 22,
          }}
          onMouseEnter={e => { if (canSwitchUnits) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          title={canSwitchUnits ? 'Chuyển đổi Công ty' : displayName}
        >
          {activeUnitId === 'all'
            ? <Globe size={12} />
            : <Building2 size={12} />
          }
          <span>{displayName}</span>
          {canSwitchUnits && (
            <ChevronUp
              size={11}
              style={{
                opacity: 0.6,
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          )}
        </button>

        {/* ── Dropdown (mở lên trên) ── */}
        {open && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              width: 320,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              zIndex: 600,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '8px 12px 6px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 10,
              color: '#64748b',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Chọn phạm vi dữ liệu
            </div>

            {/* All units option */}
            <UnitOption
              isActive={activeUnitId === 'all'}
              icon={<Globe size={13} />}
              name="Toàn hệ thống"
              code="ALL"
              subtitle={`${availableUnits.length} công ty`}
              color="#60a5fa"
              onClick={() => { setActiveUnitId('all'); setOpen(false); }}
            />

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />

            {/* Individual units */}
            {availableUnits.map(unit => (
              <UnitOption
                key={unit.id}
                isActive={activeUnitId === unit.id}
                icon={<Building2 size={13} />}
                name={unit.name}
                code={unit.code}
                color="#a3e635"
                onClick={() => { setActiveUnitId(unit.id); setOpen(false); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Separator ── */}
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />

      {/* ── Role badge ── */}
      <span style={{
        fontSize: 10,
        color: '#f59e0b',
        fontWeight: 700,
        letterSpacing: '0.05em',
        opacity: 0.85,
      }}>
        SUPER ADMIN
      </span>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── System status ── */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        color: '#22c55e',
        opacity: 0.7,
      }}>
        <CheckCircle2 size={10} />
        Hệ thống hoạt động
      </span>
    </div>
  );
}

// ─── UnitOption Item ──────────────────────────────────────────────────────────

function UnitOption({
  isActive,
  icon,
  name,
  code,
  subtitle,
  color,
  onClick,
}: {
  isActive: boolean;
  icon: React.ReactNode;
  name: string;
  code: string;
  subtitle?: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s',
        borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? '#f1f5f9' : '#94a3b8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      <span style={{
        fontSize: 10,
        color: '#475569',
        fontFamily: 'monospace',
        fontWeight: 600,
        background: 'rgba(255,255,255,0.05)',
        padding: '1px 5px',
        borderRadius: 3,
        flexShrink: 0,
      }}>
        {code}
      </span>
      {isActive && (
        <CheckCircle2 size={12} style={{ color, flexShrink: 0 }} />
      )}
    </button>
  );
}
