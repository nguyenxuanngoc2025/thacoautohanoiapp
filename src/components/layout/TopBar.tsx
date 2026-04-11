'use client';

import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import NotificationBell from './NotificationBell';

interface TopBarProps {
  userName?: string;
}

export default function TopBar({
  userName,
}: TopBarProps) {
  const pathname = usePathname();
  const currentPage = NAV_ITEMS.find(item => pathname?.startsWith(item.href));
  
  let pageTitle = currentPage?.label || '';
  if (currentPage && 'children' in currentPage && Array.isArray((currentPage as any).children)) {
    const childMatch = (currentPage as any).children.find((c: any) => pathname?.startsWith(c.href));
    if (childMatch) {
       pageTitle = `${currentPage.label} · ${childMatch.label}`;
    }
  }
  if (pathname === '/planning') pageTitle = 'Lập kế hoạch Ngân sách & KPI';
  if (pathname === '/settings/brands') pageTitle = 'QUẢN LÝ DANH MỤC THƯƠNG HIỆU VÀ DÒNG XE';


  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 12px 0 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* Page Title */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
        <span style={{ 
          fontSize: 15, 
          fontWeight: 800, 
          color: 'var(--color-brand)', 
          whiteSpace: 'nowrap', 
          textTransform: 'uppercase', 
          letterSpacing: '0.03em' 
        }}>
          {pageTitle}
        </span>
      </nav>

      <div id="topbar-portal-target" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 24, paddingRight: 8 }}>
        <NotificationBell />
      </div>
    </header>
  );
}
