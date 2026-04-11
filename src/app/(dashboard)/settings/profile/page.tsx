'use client';

import React, { useState } from 'react';
import { UserCircle, Building2, Shield, Tag, MapPin, Mail, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, type UserRole } from '@/types/database';

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, tag }: { label: string; value: string; tag?: 'good' | 'warn' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 1 }}>
        {label}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{value || '—'}</span>
        {tag === 'good' && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 7px', borderRadius: 99 }}>Active</span>}
        {tag === 'warn' && <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 7px', borderRadius: 99 }}>Bị khóa</span>}
      </div>
    </div>
  );
}

// ─── Access Badge ─────────────────────────────────────────────────────────────

function AccessBadge({ label, icon: Icon, value }: {
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  value: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      background: '#f8fafc', border: '1px solid #e2e8f0',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} style={{ color: '#2563eb' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', paddingLeft: 2 }}>{value}</div>
    </div>
  );
}

// ─── Role Chip ────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { color: string; bg: string; label: string }> = {
  super_admin:  { color: '#7c3aed', bg: '#ede9fe', label: 'Super Admin' },
  bld:          { color: '#1d4ed8', bg: '#dbeafe', label: 'Ban Lãnh Đạo' },
  giám_đốc:    { color: '#0e7490', bg: '#cffafe', label: 'Giám Đốc CN' },
  kế_toán:     { color: '#065f46', bg: '#d1fae5', label: 'Kế Toán' },
  mkt_brand:   { color: '#b45309', bg: '#fef3c7', label: 'Mkt Thương Hiệu' },
  mkt_showroom:{ color: '#be123c', bg: '#fee2e2', label: 'Mkt Showroom' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <XCircle size={32} style={{ color: '#f87171', marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: '#64748b' }}>Không tìm thấy thông tin tài khoản.</div>
      </div>
    );
  }

  const roleMeta = ROLE_META[profile.role] ?? { color: '#64748b', bg: '#f1f5f9', label: profile.role };

  return (
    <div style={{ padding: 28, maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: 14, padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(255,255,255,0.3)',
          flexShrink: 0,
        }}>
          <UserCircle size={36} style={{ color: '#fff' }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
            {profile.full_name || 'Người dùng'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={12} />
            {profile.email}
          </div>
        </div>

        {/* Role Badge */}
        <div style={{
          padding: '6px 14px', borderRadius: 99,
          background: roleMeta.bg, color: roleMeta.color,
          fontSize: 12, fontWeight: 700,
          border: `1px solid ${roleMeta.color}40`,
        }}>
          {roleMeta.label}
        </div>
      </div>

      {/* ── Access Summary ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Phạm vi truy cập</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <AccessBadge
            label="Đơn vị"
            icon={Building2}
            value={profile.unit?.name ?? '— Tất cả —'}
          />
          <AccessBadge
            label="Showroom"
            icon={MapPin}
            value={profile.showroom?.name ?? '— Tất cả —'}
          />
          <AccessBadge
            label="Thương hiệu"
            icon={Tag}
            value={profile.brands?.length ? profile.brands.join(', ') : '— Tất cả —'}
          />
        </div>
      </div>

      {/* ── Detail Info ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '4px 20px 4px' }}>
        <InfoRow label="Họ và tên" value={profile.full_name ?? ''} />
        <InfoRow label="Email đăng nhập" value={profile.email ?? ''} />
        <InfoRow label="Vai trò hệ thống" value={ROLE_LABELS[profile.role as UserRole] ?? profile.role} />
        <InfoRow
          label="Trạng thái"
          value={profile.is_active ? 'Đang hoạt động' : 'Tài khoản bị khóa'}
          tag={profile.is_active ? 'good' : 'warn'}
        />
      </div>

      {/* ── Note ── */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: 10, padding: '12px 16px',
        fontSize: 12, color: '#0369a1',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Để thay đổi mật khẩu hoặc quyền truy cập, vui lòng liên hệ <strong>Super Admin</strong> của hệ thống.
        </span>
      </div>

    </div>
  );
}
