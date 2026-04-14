'use client';

/**
 * StatusBar — Thanh trạng thái chân trang (IDE-style)
 *
 * Chỉ hiển thị với Super Admin.
 * Cho phép chuyển đổi ngữ cảnh Công ty (Unit) toàn cục.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronUp, Globe, CheckCircle2, Bell } from 'lucide-react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';

export default function StatusBar() {
  const { isSuperAdmin, profile } = useAuth();
  const { activeUnitId, activeUnit, availableUnits, canSwitchUnits, setActiveUnitId } = useUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const roleMap: Record<string, string> = {
    super_admin: 'SUPER ADMIN',
    bld: 'BAN LÃNH ĐẠO',
    gd_showroom: 'GĐ SHOWROOM',
    mkt_brand: 'MKT BRAND',
    mkt_showroom: 'MKT SHOWROOM',
    finance: 'KẾ TOÁN',
  };
  const roleDisplay = profile?.role ? (roleMap[profile.role] || profile.role.toUpperCase()) : 'USER';

  const displayName = activeUnitId === 'all'
    ? 'TOÀN HỆ THỐNG'
    : (activeUnit?.name ?? 'Đang tải...');

  return (
    <div
      style={{
        height: 28,
        background: '#e5e7eb',
        borderTop: '1px solid #d1d5db',
        color: '#111827',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        flexShrink: 0,
        zIndex: 500,
        userSelect: 'none',
      }}
    >
      {/* Đẩy toàn bộ nội dung sang phải */}
      <div style={{ flex: 1 }} />

      {/* ── System status ── */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        color: '#4b5563',
        fontWeight: 500,
      }}>
        <CheckCircle2 size={10} style={{ color: '#16a34a' }} />
        Hệ thống hoạt động
      </span>

      <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.15)' }} />

      {/* ── Role badge ── */}
      <span style={{
        fontSize: 10,
        color: '#374151',
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}>
        {roleDisplay}
      </span>

      <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.15)' }} />

      {/* ── Unit Switcher ── */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => canSwitchUnits && setOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: open ? 'rgba(0,0,0,0.06)' : 'transparent',
            border: 'none',
            borderRadius: 3,
            padding: '2px 7px',
            cursor: canSwitchUnits ? 'pointer' : 'default',
            color: '#111827',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            transition: 'background 0.15s',
            height: 22,
          }}
          onMouseEnter={e => { if (canSwitchUnits && !open) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          title={canSwitchUnits ? 'Chuyển đổi Công ty' : displayName}
        >
          {activeUnitId === 'all'
            ? <Globe size={12} style={{ color: '#4b5563' }} />
            : <Building2 size={12} style={{ color: '#4b5563' }} />
          }
          <span>{displayName}</span>
          {canSwitchUnits && (
            <ChevronUp
              size={11}
              style={{
                opacity: 0.7,
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
                color: '#4b5563',
              }}
            />
          )}
        </button>

        {/* ── Dropdown ── */}
        {open && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 4,
              width: 320,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              zIndex: 600,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '8px 12px 6px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: 10,
              color: '#6b7280',
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
              color="#2563eb"
              onClick={() => { setActiveUnitId('all'); setOpen(false); }}
            />

            {/* Divider */}
            <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0' }} />

            {/* Individual units */}
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {availableUnits.map(unit => (
                <UnitOption
                  key={unit.id}
                  isActive={activeUnitId === unit.id}
                  icon={<Building2 size={13} />}
                  name={unit.name}
                  code={unit.code}
                  color="#16a34a"
                  onClick={() => { setActiveUnitId(unit.id); setOpen(false); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.15)' }} />

      {/* ── Notification (WIP) ── */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: '4px',
          borderRadius: 4,
          cursor: 'pointer',
          color: '#4b5563',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)';
          (e.currentTarget as HTMLElement).style.color = '#111827';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#4b5563';
        }}
        title="Thông báo (Đang phát triển)"
      >
        <Bell size={13} />
      </button>
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
        background: isActive ? '#f8fafc' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ color: isActive ? color : '#64748b', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? '#0f172a' : '#475569',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      <span style={{
        fontSize: 10,
        color: '#64748b',
        fontFamily: 'monospace',
        fontWeight: 600,
        background: isActive ? '#e2e8f0' : '#f1f5f9',
        padding: '1px 5px',
        borderRadius: 3,
        flexShrink: 0,
      }}>
        {code}
      </span>
      {isActive && (
        <CheckCircle2 size={12} style={{ color, flexShrink: 0, marginLeft: 4 }} />
      )}
    </button>
  );
}
