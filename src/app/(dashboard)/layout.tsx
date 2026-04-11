import React from 'react';
import AppProviders from '@/components/providers/AppProviders';
import DashboardShell from '@/components/layout/DashboardShell';

// Legacy type export
export type SidebarMode = 'pinned' | 'auto' | 'collapsed';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // LƯU Ý: Đây đã trở thành Server Component chuẩn của Next.js (không còn 'use client' ở đầu).
  // Mọi thành phần render tĩnh bên trong children sẽ được Server side rendering giúp SEO tốt và giảm TTFB.
  return (
    <AppProviders>
      <DashboardShell>
        {children}
      </DashboardShell>
    </AppProviders>
  );
}
