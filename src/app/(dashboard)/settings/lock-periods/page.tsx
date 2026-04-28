'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LockPeriod {
  unit_id: string;
  year: number;
  month: number;
  entry_type: 'plan' | 'actual';
  is_locked: boolean;
  locked_by_name: string | null;
  locked_at: string | null;
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#2563eb' : '#cbd5e1',
        transition: 'background 0.2s', padding: 0, flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
      title={checked ? 'Đang khóa — click để mở khóa' : 'Đang mở — click để khóa'}
    >
      <span style={{
        position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
        left: checked ? 21 : 3,
      }} />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CURRENT_YEAR = new Date().getFullYear();

export default function LockPeriodsPage() {
  const { effectiveRole, profile } = useAuth();
  const { activeUnitId } = useUnit();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [locks, setLocks] = useState<LockPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null); // "month-type" being toggled

  const canEdit = effectiveRole === 'pt_mkt_cty' || effectiveRole === 'super_admin';

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLocks = useCallback(async () => {
    if (!activeUnitId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/planning/lock-periods?unit_id=${activeUnitId}&year=${year}`
      );
      if (res.ok) {
        const data = await res.json();
        setLocks(data.periods || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeUnitId, year]);

  useEffect(() => { fetchLocks(); }, [fetchLocks]);

  // ─── Toggle ─────────────────────────────────────────────────────────────────

  const handleToggle = async (month: number, entry_type: 'plan' | 'actual', newValue: boolean) => {
    if (!activeUnitId || !canEdit) return;
    const key = `${month}-${entry_type}`;
    setToggling(key);
    try {
      await fetch('/api/planning/lock-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: activeUnitId,
          year,
          month,
          entry_type,
          is_locked: newValue,
          locker_name: profile?.full_name || profile?.email || '',
        }),
      });
      // Cập nhật local state ngay
      setLocks(prev => {
        const existing = prev.find(l => l.month === month && l.entry_type === entry_type);
        if (existing) {
          return prev.map(l =>
            l.month === month && l.entry_type === entry_type
              ? { ...l, is_locked: newValue, locked_at: newValue ? new Date().toISOString() : null, locked_by_name: newValue ? (profile?.full_name || '') : null }
              : l
          );
        }
        return [...prev, {
          unit_id: activeUnitId,
          year,
          month,
          entry_type,
          is_locked: newValue,
          locked_by_name: newValue ? (profile?.full_name || '') : null,
          locked_at: newValue ? new Date().toISOString() : null,
        }];
      });
    } finally {
      setToggling(null);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getLock = (month: number, entry_type: 'plan' | 'actual') =>
    locks.find(l => l.month === month && l.entry_type === entry_type);

  const isLocked = (month: number, entry_type: 'plan' | 'actual') =>
    getLock(month, entry_type)?.is_locked || false;

  const lockedByName = (month: number, entry_type: 'plan' | 'actual') =>
    getLock(month, entry_type)?.locked_by_name || null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 28px', maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Lock size={20} color="#2563eb" />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Khóa kỳ chỉnh sửa
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Bật khóa để ngăn chỉnh sửa dữ liệu KH (Kế hoạch) hoặc TH (Thực hiện) của tháng tương ứng.
          Chỉ <strong>PT Marketing Công ty</strong> và <strong>Quản trị viên</strong> có quyền thay đổi.
        </p>
      </div>

      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Năm:</span>
        {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            style={{
              padding: '4px 14px', borderRadius: 5, fontSize: 13, fontWeight: y === year ? 700 : 400,
              border: `1px solid ${y === year ? '#2563eb' : '#e2e8f0'}`,
              background: y === year ? '#2563eb' : '#fff',
              color: y === year ? '#fff' : '#475569',
              cursor: 'pointer',
            }}
          >{y}</button>
        ))}
      </div>

      {/* Read-only notice */}
      {!canEdit && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 7, marginBottom: 16,
          background: '#fef9c3', border: '1px solid #fde047', fontSize: 12, color: '#92400e',
        }}>
          <AlertCircle size={14} />
          Bạn chỉ có quyền xem. Chỉ PT Marketing Công ty hoặc Quản trị viên mới được thay đổi.
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Đang tải...
        </div>
      ) : (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#eef2f7' }}>
                <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', width: 100 }}>
                  Tháng
                </th>
                <th style={{ padding: '9px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#2563eb', borderBottom: '1px solid #e2e8f0', width: 200 }}>
                  KH (Kế hoạch)
                </th>
                <th style={{ padding: '9px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#d97706', borderBottom: '1px solid #e2e8f0', width: 200 }}>
                  TH (Thực hiện)
                </th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, idx) => {
                const planLocked = isLocked(m, 'plan');
                const actualLocked = isLocked(m, 'actual');
                const planLockedBy = lockedByName(m, 'plan');
                const actualLockedBy = lockedByName(m, 'actual');
                const isTogglingPlan = toggling === `${m}-plan`;
                const isTogglingActual = toggling === `${m}-actual`;

                return (
                  <tr key={m} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      Tháng {m}/{year}
                    </td>

                    {/* KH */}
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isTogglingPlan ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                          ) : (
                            <ToggleSwitch
                              checked={planLocked}
                              onChange={(v) => handleToggle(m, 'plan', v)}
                              disabled={!canEdit}
                            />
                          )}
                          <span style={{ fontSize: 11, fontWeight: 600, color: planLocked ? '#dc2626' : '#16a34a' }}>
                            {planLocked ? 'Đã khóa' : 'Mở'}
                          </span>
                        </div>
                        {planLocked && planLockedBy && (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>bởi {planLockedBy}</span>
                        )}
                      </div>
                    </td>

                    {/* TH */}
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isTogglingActual ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                          ) : (
                            <ToggleSwitch
                              checked={actualLocked}
                              onChange={(v) => handleToggle(m, 'actual', v)}
                              disabled={!canEdit}
                            />
                          )}
                          <span style={{ fontSize: 11, fontWeight: 600, color: actualLocked ? '#dc2626' : '#16a34a' }}>
                            {actualLocked ? 'Đã khóa' : 'Mở'}
                          </span>
                        </div>
                        {actualLocked && actualLockedBy && (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>bởi {actualLockedBy}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
