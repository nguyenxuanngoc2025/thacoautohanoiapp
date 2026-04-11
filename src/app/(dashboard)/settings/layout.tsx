'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tag, Users, Building2, Zap, Radio, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ─── Menu Config ──────────────────────────────────────────────────────────────

const GROUP_BUSINESS = [
  { href: '/settings/companies',  label: 'Cơ cấu Tổ chức',          icon: Building2, desc: 'Đơn vị, Showroom & Hãng xe' },
  { href: '/settings/brands',     label: 'Danh mục Sản phẩm',        icon: Tag,       desc: 'Thương hiệu & Dòng xe' },
  { href: '/settings/accounts',   label: 'Tài khoản & Phân quyền',   icon: Users,     desc: 'Nhân sự, vai trò, scope' },
  { href: '/settings/channels',   label: 'Cấu hình Kênh Marketing',  icon: Radio,     desc: 'Kênh, danh mục chi tiêu' },
];

const GROUP_PERSONAL = [
  { href: '/settings/profile', label: 'Hồ sơ của tôi', icon: UserCircle, desc: 'Thông tin tài khoản' },
  { href: '/settings/system',  label: 'Công cụ Kỹ thuật', icon: Zap,     desc: 'Kiểm tra DB & cấu hình', adminOnly: true },
];

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

function NavItem({ href, label, icon: Icon, desc, active }: {
  href: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  desc: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 7,
        textDecoration: 'none',
        background: active ? 'var(--color-brand, #2563eb)15' : 'transparent',
        border: active ? '1px solid var(--color-brand, #2563eb)30' : '1px solid transparent',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
        background: active ? '#2563eb' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}>
        <Icon size={15} style={{ color: active ? '#fff' : '#64748b' }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.3,
          color: active ? '#2563eb' : '#0f172a',
          whiteSpace: 'nowrap',
        }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap' }}>{desc}</div>
      </div>
    </Link>
  );
}

// ─── Sidebar Group Label ──────────────────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      padding: '4px 12px 6px', marginTop: 4,
    }}>
      {children}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--color-border, #e2e8f0)',
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '16px 8px',
        overflowY: 'auto',
        gap: 2,
      }}>

        <GroupLabel>Quản trị Nghiệp vụ</GroupLabel>
        {GROUP_BUSINESS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        <div style={{ height: 1, background: '#f0f4f8', margin: '10px 4px 6px' }} />

        <GroupLabel>Cá nhân & Hệ thống</GroupLabel>
        {GROUP_PERSONAL.filter(item => !item.adminOnly || isSuperAdmin).map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </aside>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
