'use client';
import { Download } from 'lucide-react';
import { useState } from 'react';

export function ExportButton({
  label = 'Xuất Excel',
  onExport,
  disabled = false,
}: {
  label?: string;
  onExport: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try { await onExport(); } finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px',
        background: '#16a34a',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--border-radius-erp)',
        fontSize: 'var(--fs-body)', fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.65 : 1,
        flexShrink: 0,
      }}
    >
      <Download size={13} />
      {loading ? 'Đang xuất...' : label}
    </button>
  );
}
