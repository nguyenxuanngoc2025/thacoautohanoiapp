'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tag, Users, Building2, Zap } from 'lucide-react';

const SETTINGS_TABS = [
  { href: '/settings/system', label: 'Thiết lập Hệ thống', icon: Zap },
  { href: '/settings/companies', label: 'Công ty & Showroom', icon: Building2 },
  { href: '/settings/accounts', label: 'Tài khoản & Phân quyền', icon: Users },
  { href: '/settings/brands', label: 'Thương hiệu & Dòng xe', icon: Tag },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 24, background: '#fff' }}>
        {SETTINGS_TABS.map(t => {
          const active = pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} style={{ 
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0', 
              fontSize: 13, fontWeight: 600, color: active ? '#2563eb' : '#64748b',
              borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
              textDecoration: 'none', transition: 'all 0.2s'
            }}>
              <Icon size={14} />
              {t.label}
            </Link>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
