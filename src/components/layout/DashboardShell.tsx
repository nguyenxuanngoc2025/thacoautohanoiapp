'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { ROLE_LABELS } from '@/types/database';
import Sidebar from '@/components/layout/Sidebar';
import StatusBar from '@/components/layout/StatusBar';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, isLoading, authUser, effectiveRole, previewRole } = useAuth();
  const { activeUnit, activeUnitId } = useUnit();
  const [collapsed, setCollapsed] = useState(false);

  // Catch unauthenticated case via client-side redirect safely
  React.useEffect(() => {
    if (!isLoading && !authUser) {
      router.replace('/login');
    }
  }, [isLoading, authUser, router]);

  // Chờ auth xong trước khi render shell. Quá trình fetch profile có thể mất chút ms.
  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Bộ khung xương Skeleton cơ bản */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500 }}>Đang khởi tạo phiên làm việc...</span>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  // effectiveRole: role giả lập (khi preview) hoặc role thực của user
  const userRole = (effectiveRole ?? profile?.role ?? 'mkt_showroom') as import('@/types/database').UserRole;
  const userName = profile?.full_name ?? (authUser.email ?? 'Unknown');
  // Subtitle hiển thị role đang active (có thể là preview)
  const userSubtitle = previewRole
    ? `${ROLE_LABELS[previewRole]} (Preview)`
    : (profile?.role ? ROLE_LABELS[profile.role] : 'Unknown Role');

  // companyName: ưu tiên activeUnit (khi super_admin chọn Unit cụ thể)
  // → 'all' → hiển thị 'TOÀN HỆ THỐNG'
  // → Unit cụ thể → tên Unit đó
  // → fallback về profile.unit.name
  const companyName = activeUnitId === 'all'
    ? 'TOÀN HỆ THỐNG'
    : (activeUnit?.name ?? profile?.unit?.name ?? 'THACO AUTO');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)', flexDirection: 'column' }}>
      {/* Main layout (sidebar + content) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          userRole={userRole}
          userName={userName}
          userCode={userSubtitle}
          companyName={companyName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(prev => !prev)}
        />

        {/* Content area */}
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
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', position: 'relative' }}>
            {children}
          </main>
        </div>
      </div>

      {/* StatusBar — chân trang, chỉ hiện với super_admin */}
      <StatusBar />
    </div>
  );
}
