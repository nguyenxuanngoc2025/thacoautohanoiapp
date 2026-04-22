'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Tag, Users, Building2, Zap, Radio, UserCircle, Sun, BarChart2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { type UserRole } from '@/types/database';

// ─── Menu Config ──────────────────────────────────────────────────────────────

/**
 * ADMIN_ROLES: được xem toàn bộ cài đặt hệ thống
 * Tất cả role khác: chỉ xem Hồ sơ + Giao diện
 */
const ADMIN_ROLES: UserRole[] = ['super_admin', 'pt_mkt_cty'];

/** Menu quản trị — chỉ ADMIN_ROLES */
const GROUP_ADMIN = [
  { href: '/settings/companies', label: 'Cơ cấu Tổ chức',         icon: Building2, desc: 'Đơn vị, Showroom & Hãng xe',
    superAdminOnly: true },
  { href: '/settings/brands',    label: 'Danh mục Sản phẩm',       icon: Tag,       desc: 'Thương hiệu & Dòng xe' },
  { href: '/settings/accounts',  label: 'Tài khoản & Phân quyền',  icon: Users,     desc: 'Nhân sự, vai trò, scope',
    superAdminOnly: true },
  { href: '/settings/channels',  label: 'Cấu hình Kênh Marketing', icon: Radio,     desc: 'Kênh, danh mục chi tiêu' },
  { href: '/settings/metrics',   label: 'Chỉ số KPI',              icon: BarChart2, desc: 'Chỉ số đo lường hiệu suất' },
];

/** Menu công cụ hệ thống — chỉ super_admin */
const GROUP_SYSTEM = [
  { href: '/settings/system', label: 'Công cụ Kỹ thuật', icon: Zap, desc: 'Kiểm tra DB & cấu hình' },
];

/** Menu cá nhân — tất cả role đều thấy */
const GROUP_PERSONAL = [
  { href: '/settings/profile',    label: 'Hồ sơ của tôi', icon: UserCircle, desc: 'Thông tin tài khoản' },
  { href: '/settings/appearance', label: 'Giao diện',      icon: Sun,        desc: 'Light / Dark mode' },
];

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

function NavItem({ href, label, icon: Icon, desc, active }: {
  href: string; label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  desc: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 7, textDecoration: 'none',
        background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
        border: active ? '1px solid rgba(37,99,235,0.18)' : '1px solid transparent',
        transition: 'all 0.15s', cursor: 'pointer',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
          color: active ? '#2563eb' : '#0f172a', whiteSpace: 'nowrap',
        }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap' }}>{desc}</div>
      </div>
    </Link>
  );
}

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

function Divider() {
  return <div style={{ height: 1, background: '#f0f4f8', margin: '8px 4px' }} />;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { effectiveRole, effectiveIsSuperAdmin } = useAuth();

  const router = useRouter();

  const activeRole = (effectiveRole ?? 'mkt_showroom') as UserRole;
  const isAdminRole = ADMIN_ROLES.includes(activeRole);

  // pt_mkt_cty không thấy các mục superAdminOnly
  const visibleAdmin   = isAdminRole ? GROUP_ADMIN.filter(i => !i.superAdminOnly || effectiveIsSuperAdmin) : [];
  const visibleSystem  = effectiveIsSuperAdmin ? GROUP_SYSTEM : [];

  const allVisiblePaths = [
    ...visibleAdmin.map(i => i.href),
    ...visibleSystem.map(i => i.href),
    ...GROUP_PERSONAL.map(i => i.href)
  ];

  React.useEffect(() => {
    // If the path is strictly inside settings/ but NOT one of the visible paths, redirect to profile
    if (pathname !== '/settings' && !allVisiblePaths.some(p => pathname.startsWith(p))) {
      router.replace('/settings/profile');
    }
  }, [pathname, allVisiblePaths, router]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside className="no-scrollbar" style={{
        width: 250, flexShrink: 0,
        borderRight: '1px solid var(--color-border, #e2e8f0)',
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '16px 8px',
        overflowY: 'auto', gap: 2,
      }}>

        {/* Quản trị hệ thống — super_admin & pt_mkt_cty */}
        {visibleAdmin.length > 0 && (
          <>
            <GroupLabel>Quản trị Hệ thống</GroupLabel>
            {visibleAdmin.map(item => (
              <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
            <Divider />
          </>
        )}

        {/* Công cụ kỹ thuật — super_admin only */}
        {visibleSystem.length > 0 && (
          <>
            <GroupLabel>Công cụ</GroupLabel>
            {visibleSystem.map(item => (
              <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
            <Divider />
          </>
        )}

        {/* Cá nhân — tất cả role đều thấy */}
        <GroupLabel>Cá nhân</GroupLabel>
        {GROUP_PERSONAL.map(item => (
          <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
      </aside>

      {/* ── Content ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
