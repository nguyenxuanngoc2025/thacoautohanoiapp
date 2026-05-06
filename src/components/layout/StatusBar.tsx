'use client';

/**
 * StatusBar — Thanh trạng thái chân trang (IDE-style)
 *
 * Super Admin: click vào Role Badge → mở Role Switcher để giả lập giao diện theo role.
 * previewRole được lưu trong AuthContext → lan truyền toàn app.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, ChevronUp, Globe, CheckCircle2, Bell, ShieldCheck, Eye, ChevronDown, Store } from 'lucide-react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import NotificationPanel from './NotificationPanel';
import { generateNotifications, invalidateNotifCache } from '@/lib/notifications-engine';
import {
  type UserRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_SCOPE,
} from '@/types/database';

// ─── Role Badge Colors ─────────────────────────────────────────────────────────

const ROLE_BADGE_COLOR: Record<UserRole, { bg: string; text: string; border: string }> = {
  super_admin:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  pt_mkt_cty:   { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  bld:          { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  gd_brand:     { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  gd_showroom:  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  mkt_brand:    { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  mkt_showroom: { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
  finance:      { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
};

// ─── Role Switcher Popup ───────────────────────────────────────────────────────

function RoleSwitcherPopup({
  currentRole,
  onSelect,
  onClose,
}: {
  currentRole: UserRole;
  onSelect: (r: UserRole) => void;
  onClose: () => void;
}) {
  const roles = Object.keys(ROLE_LABELS) as UserRole[];

  return (
    <div
      className="dropdown-panel"
      style={{
        position: 'absolute', bottom: '100%', right: 0,
        marginBottom: 4, width: 500, overflow: 'hidden', zIndex: 600,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <div className="dropdown-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eye size={13} style={{ color: '#6b7280' }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Giả lập giao diện theo Vai trò
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
            Chỉ Super Admin mới thấy tùy chọn này
          </div>
        </div>
      </div>

      {/* Role list */}
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {roles.map(role => {
          const isActive = role === currentRole;
          const c = ROLE_BADGE_COLOR[role];
          return (
            <button
              key={role}
              onClick={() => { onSelect(role); onClose(); }}
              className={`dropdown-item${isActive ? ' active' : ''}`}
              style={{
                borderLeft: `3px solid ${isActive ? c.border : 'transparent'}`,
              }}
            >
              {/* Role icon dot */}
              <div style={{
                width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                background: c.bg, border: `1.5px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: c.text }}>
                  {ROLE_LABELS[role].slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? c.text : '#1f2937' }}>
                    {ROLE_LABELS[role]}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      Hiện tại
                    </span>
                  )}
                  {role === 'super_admin' && (
                    <ShieldCheck size={11} style={{ color: '#d97706' }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>
                  {ROLE_DESCRIPTIONS[role]}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: '#d1d5db' }}>Phạm vi:</span>
                  {ROLE_SCOPE[role]}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="dropdown-footer" style={{ fontSize: 10 }}>
        Giả lập để preview — không ảnh hưởng dữ liệu thực
      </div>
    </div>
  );
}

// ─── Main StatusBar ───────────────────────────────────────────────────────────

export default function StatusBar() {
  const { isSuperAdmin, profile, previewRole, setPreviewRole, effectiveRole: ctxEffectiveRole } = useAuth();
  const { activeUnitId, activeUnit, availableUnits, canSwitchUnits, setActiveUnitId } = useUnit();
  const { allShowrooms } = useShowrooms();

  // Showroom names cho mkt_showroom / gd_showroom
  const assignedShowroomNames = React.useMemo(() => {
    const codes = profile?.showroom_ids ?? [];
    if (codes.length === 0) return null;
    const names = allShowrooms.filter(s => codes.includes(s.code)).map(s => s.name);
    return names.length > 0 ? names : null;
  }, [profile?.showroom_ids, allShowrooms]);

  const [unitOpen, setUnitOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCounts, setNotifCounts] = useState<{ unread: number; urgent: number }>({ unread: 0, urgent: 0 });

  const unitRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Load notification counts — chỉ chạy khi mount hoặc activeUnitId thay đổi
  // Không re-fetch khi đóng panel (tránh double-fire khi mount vì notifOpen=false ngay từ đầu)
  const loadNotifCounts = useCallback(async () => {
    try {
      const result = await generateNotifications(activeUnitId !== 'all' ? activeUnitId : undefined, false, profile);
      setNotifCounts({ unread: result.counts.unread, urgent: result.counts.urgent });
    } catch { /* silent */ }
  }, [activeUnitId, profile]);

  useEffect(() => { loadNotifCounts(); }, [loadNotifCounts]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) setUnitOpen(false);
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
    };
    if (unitOpen || roleOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [unitOpen, roleOpen]);

  // effectiveRole từ context — lan truyền toàn app
  const effectiveRole: UserRole = (ctxEffectiveRole ?? profile?.role ?? 'mkt_showroom') as UserRole;
  const c = ROLE_BADGE_COLOR[effectiveRole];
  const roleLabel = ROLE_LABELS[effectiveRole] ?? effectiveRole.toUpperCase();
  const isPreviewMode = previewRole !== null && previewRole !== profile?.role;

  const displayName = activeUnitId === 'all'
    ? 'TOÀN HỆ THỐNG'
    : (activeUnit?.name ?? 'Đang tải...');

  return (
    <div className="status-bar">
      {/* Đẩy nội dung sang phải */}
      <div style={{ flex: 1 }} />

      {/* Preview mode indicator */}
      {isPreviewMode && (
        <>
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#b45309',
            background: '#fef3c7', border: '1px solid #fde68a',
            padding: '1px 6px', borderRadius: 10, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            PREVIEW MODE
          </span>
          <button
            onClick={() => setPreviewRole(null)}
            style={{
              fontSize: 9, fontWeight: 600, color: '#6b7280',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px 4px',
              textDecoration: 'underline',
            }}
          >
            Thoát
          </button>
          <div className="status-sep" />
        </>
      )}

      {/* ── System status ── */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4b5563', fontWeight: 500 }}>
        <CheckCircle2 size={10} style={{ color: '#16a34a' }} />
        Hệ thống hoạt động
      </span>

      <div className="status-sep" />

      {/* ── Role badge (clickable nếu super_admin) ── */}
      <div ref={roleRef} style={{ position: 'relative' }}>
        <button
          onClick={() => isSuperAdmin && setRoleOpen(v => !v)}
          title={isSuperAdmin ? 'Click để giả lập giao diện theo vai trò' : roleLabel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 20,
            padding: '0 7px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: c.text,
            background: roleOpen ? c.bg : (isPreviewMode ? c.bg : 'transparent'),
            border: isPreviewMode ? `1px solid ${c.border}` : '1px solid transparent',
            borderRadius: 3,
            cursor: isSuperAdmin ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (isSuperAdmin) { (e.currentTarget as HTMLElement).style.background = c.bg; (e.currentTarget as HTMLElement).style.borderColor = c.border; } }}
          onMouseLeave={e => { if (!roleOpen && !isPreviewMode) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; } }}
        >
          <span
            style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c.border, flexShrink: 0 }}
          />
          {roleLabel}
          {isSuperAdmin && (
            <ChevronDown
              size={9}
              style={{ opacity: 0.6, transform: roleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          )}
        </button>

        {/* Role Switcher Popup */}
        {roleOpen && isSuperAdmin && (
          <RoleSwitcherPopup
            currentRole={effectiveRole}
            onSelect={r => setPreviewRole(r)}
            onClose={() => setRoleOpen(false)}
          />
        )}
      </div>

      <div className="status-sep" />

      {/* ── Showroom (chỉ hiển thị cho mkt_showroom / gd_showroom) ── */}
      {assignedShowroomNames && (
        <>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4b5563', fontWeight: 500 }}>
            <Store size={11} style={{ color: '#6b7280' }} />
            {assignedShowroomNames.join(', ')}
          </span>
          <div className="status-sep" />
        </>
      )}

      {/* ── Unit Switcher ── */}
      <div ref={unitRef} style={{ position: 'relative' }}>
        <button
          onClick={() => canSwitchUnits && setUnitOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: unitOpen ? 'rgba(0,0,0,0.06)' : 'transparent',
            border: 'none', borderRadius: 3, padding: '2px 7px',
            cursor: canSwitchUnits ? 'pointer' : 'default',
            color: '#111827', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.02em', transition: 'background 0.15s', height: 22,
          }}
          onMouseEnter={e => { if (canSwitchUnits && !unitOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={e => { if (!unitOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
                transform: unitOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s', color: '#4b5563',
              }}
            />
          )}
        </button>

        {/* Unit Dropdown */}
        {unitOpen && (
          <div className="dropdown-panel" style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
            width: 320, overflow: 'hidden', zIndex: 600,
          }}>
            <div className="dropdown-header" style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Chọn phạm vi dữ liệu
            </div>
            <UnitOption
              isActive={activeUnitId === 'all'}
              icon={<Globe size={13} />}
              name="Toàn hệ thống"
              code="ALL"
              subtitle={`${availableUnits.length} công ty`}
              color="#2563eb"
              onClick={() => { setActiveUnitId('all'); setUnitOpen(false); }}
            />
            <div style={{ height: 1, background: 'var(--color-border-light)', margin: '2px 0' }} />
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {availableUnits.map(unit => (
                <UnitOption
                  key={unit.id}
                  isActive={activeUnitId === unit.id}
                  icon={<Building2 size={13} />}
                  name={unit.name}
                  code={unit.code}
                  color="#16a34a"
                  onClick={() => { setActiveUnitId(unit.id); setUnitOpen(false); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="status-sep" />

      {/* ── Notification Bell ── */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bellRef}
          onClick={() => setNotifOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: notifOpen ? 'rgba(0,0,0,0.08)' : 'transparent',
            border: 'none', padding: '4px', borderRadius: 4, cursor: 'pointer',
            color: notifOpen ? '#111827' : '#4b5563', transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (!notifOpen) { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = '#111827'; } }}
          onMouseLeave={e => { if (!notifOpen) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#4b5563'; } }}
          title={notifCounts.unread > 0 ? `${notifCounts.unread} thông báo chưa đọc` : 'Thông báo'}
        >
          <Bell size={13} />
          {notifCounts.unread > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 14, height: 14,
              background: notifCounts.urgent > 0 ? '#dc2626' : '#3b82f6',
              color: '#fff', borderRadius: 7, fontSize: 8, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', border: '1.5px solid #e5e7eb', lineHeight: 1,
            }}>
              {notifCounts.unread > 9 ? '9+' : notifCounts.unread}
            </span>
          )}
        </button>

        <NotificationPanel
          open={notifOpen}
          onClose={() => {
            setNotifOpen(false);
            // Invalidate cache khi đóng panel để lần mở tiếp luôn fresh
            invalidateNotifCache();
            // Cập nhật badge count sau 100ms (đủ cho cache clear)
            setTimeout(loadNotifCounts, 100);
          }}
          anchorRef={bellRef}
        />
      </div>
    </div>
  );
}

// ─── UnitOption Item ──────────────────────────────────────────────────────────

function UnitOption({ isActive, icon, name, code, subtitle, color, onClick }: {
  isActive: boolean; icon: React.ReactNode; name: string; code: string;
  subtitle?: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`dropdown-item${isActive ? ' active' : ''}`}
      style={{ borderLeft: `2px solid ${isActive ? color : 'transparent'}` }}
    >
      <span style={{ color: isActive ? color : 'var(--color-text-muted)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600, background: 'var(--color-surface-hover)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
        {code}
      </span>
      {isActive && <CheckCircle2 size={12} style={{ color, flexShrink: 0, marginLeft: 4 }} />}
    </button>
  );
}
