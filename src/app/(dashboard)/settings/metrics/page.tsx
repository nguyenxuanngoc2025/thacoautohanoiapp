'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, ToggleLeft, ToggleRight, Loader2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { MasterMetric } from '@/types/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALUE_TYPE_LABELS: Record<MasterMetric['value_type'], string> = {
  currency_million: 'Triệu đồng',
  integer: 'Số nguyên',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MetricsSettingsPage() {
  const { effectiveIsSuperAdmin: isSuperAdmin } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);

  const [metrics, setMetrics] = useState<MasterMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('thaco_master_metrics')
      .select('*')
      .order('sort_order');
    if (err) { setError(err.message); setLoading(false); return; }
    setMetrics(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(metric: MasterMetric) {
    setTogglingId(metric.id);
    const { error: err } = await supabase
      .from('thaco_master_metrics')
      .update({ is_active: !metric.is_active })
      .eq('id', metric.id);
    if (err) {
      setError(`Không thể cập nhật "${metric.name}": ${err.message}`);
    } else {
      setMetrics(prev =>
        prev.map(m => m.id === metric.id ? { ...m, is_active: !metric.is_active } : m)
      );
    }
    setTogglingId(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div>
        <h1 style={{
          margin: 0, fontSize: 20, fontWeight: 700,
          color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <BarChart2 size={20} style={{ color: 'var(--color-brand)' }} />
          Chỉ số KPI
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Danh sach cac chi so do luong hieu suat marketing. Co the an/hien tung chi so.
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626',
        }}>
          {error}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Dang tai du lieu...
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid var(--color-border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 160px 100px 80px',
            gap: 0,
            background: '#f8fafc',
            borderBottom: '1px solid var(--color-border)',
            padding: '9px 16px',
          }}>
            {(['Ma', 'Ten chi so', 'Loai gia tri', 'So thap phan', 'Trang thai'] as const).map((label, i) => (
              <div key={i} style={{
                fontSize: 11, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                textAlign: i >= 2 ? 'center' : 'left',
              }}>
                {label === 'Ma' ? 'Mã' :
                  label === 'Ten chi so' ? 'Tên chỉ số' :
                  label === 'Loai gia tri' ? 'Loại giá trị' :
                  label === 'So thap phan' ? 'Số thập phân' :
                  'Trạng thái'}
              </div>
            ))}
          </div>

          {/* Rows */}
          {metrics.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Chưa có chỉ số nào được cấu hình
            </div>
          ) : (
            metrics.map((metric, idx) => (
              <div
                key={metric.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 160px 100px 80px',
                  gap: 0,
                  padding: '11px 16px',
                  borderBottom: idx < metrics.length - 1 ? '1px solid var(--color-border)' : 'none',
                  alignItems: 'center',
                  background: metric.is_active ? '#fff' : '#fafafa',
                  transition: 'background 0.15s',
                  opacity: metric.is_active ? 1 : 0.6,
                }}
              >
                {/* Mã (read-only, system-defined) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                    color: 'var(--color-text-muted)', background: '#f1f5f9',
                    border: '1px solid var(--color-border)', borderRadius: 4,
                    padding: '2px 6px', letterSpacing: '0.05em',
                  }}>
                    {metric.code}
                  </span>
                  <Lock size={10} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                </div>

                {/* Tên */}
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--color-text)',
                }}>
                  {metric.name}
                  {!metric.is_active && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      [Đã ẩn]
                    </span>
                  )}
                </div>

                {/* Loại giá trị */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: metric.value_type === 'currency_million' ? '#0369a1' : '#059669',
                    background: metric.value_type === 'currency_million' ? '#e0f2fe' : '#d1fae5',
                    borderRadius: 5, padding: '2px 8px',
                  }}>
                    {VALUE_TYPE_LABELS[metric.value_type]}
                  </span>
                </div>

                {/* Số thập phân */}
                <div style={{
                  textAlign: 'center',
                  fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500,
                }}>
                  {metric.decimals}
                </div>

                {/* Toggle is_active */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {isSuperAdmin ? (
                    <button
                      onClick={() => toggleActive(metric)}
                      disabled={togglingId === metric.id}
                      title={metric.is_active ? 'An chi so nay' : 'Hien chi so nay'}
                      style={{
                        padding: 6, borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: '#fff',
                        cursor: togglingId === metric.id ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {togglingId === metric.id ? (
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                      ) : metric.is_active ? (
                        <ToggleRight size={18} style={{ color: 'var(--color-brand)' }} />
                      ) : (
                        <ToggleLeft size={18} style={{ color: '#94a3b8' }} />
                      )}
                    </button>
                  ) : (
                    /* Read-only indicator for non-admins */
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {metric.is_active ? (
                        <ToggleRight size={18} style={{ color: 'var(--color-brand)', opacity: 0.5 }} />
                      ) : (
                        <ToggleLeft size={18} style={{ color: '#94a3b8', opacity: 0.5 }} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Footer note ── */}
      {!loading && metrics.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--color-text-muted)',
        }}>
          <Lock size={11} />
          Chỉ số KPI là dữ liệu hệ thống — không thể thêm hoặc xóa, chỉ có thể ẩn/hiện.
        </div>
      )}
    </div>
  );
}
