'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import { BrandsProvider } from '@/contexts/BrandsContext';
import { ShowroomsProvider } from '@/contexts/ShowroomsContext';
import { useAuth } from '@/contexts/AuthContext';

// Legacy export để không break các import cũ nếu có
export type SidebarMode = 'pinned' | 'auto' | 'collapsed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, isLoading, authUser } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Chờ auth xong trước khi render
  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>Đang tải...</span>
      </div>
    );
  }

  // Middleware đã redirect nhưng client-side cần bắt thêm
  if (!authUser) {
    router.replace('/login');
    return null;
  }

  const userRole = profile?.role ?? 'mkt_showroom';
  const userName = profile?.full_name ?? (authUser.email ?? 'Unknown');
  const userCode = profile?.email?.split('@')[0]?.toUpperCase() ?? '';
  const companyName = profile?.unit?.name ?? 'THACO AUTO';

  return (
    <BrandsProvider>
      <ShowroomsProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
        <Sidebar
          userRole={userRole}
          userName={userName}
          userCode={userCode}
          companyName={companyName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(prev => !prev)}
        />

        {/* Content area — animate left margin cùng với sidebar width */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
            transition: 'flex 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <TopBar userName={userName} />
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', position: 'relative' }}>
            {children}
          </main>
        </div>
      </div>
      </ShowroomsProvider>
    </BrandsProvider>
  );
}
