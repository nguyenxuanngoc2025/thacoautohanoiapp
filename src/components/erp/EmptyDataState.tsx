'use client';

import { FolderOpen } from 'lucide-react';

export function EmptyDataState({ message = "Chưa có dữ liệu giao dịch cho thiết lập này" }: { message?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 160,
      background: 'rgba(248, 250, 252, 0.5)',
      borderRadius: 'var(--border-radius-md)',
      border: '1px dashed var(--color-border)',
      color: 'var(--color-text-muted)'
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12
      }}>
        <FolderOpen size={24} style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>{message}</span>
    </div>
  );
}
