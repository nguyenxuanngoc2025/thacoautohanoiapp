import React, { useState } from 'react';
import { FileCheck2, X } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { type EventItem } from '@/lib/events-data';

export default function CloseReportModal({ ev, onClose, onSave }: {
  ev: EventItem;
  onClose: () => void;
  onSave: (updated: EventItem) => void;
}) {
  const [spent, setSpent] = useState(ev.budgetSpent ?? 0);
  const [leadsA, setLeadsA] = useState(ev.leadsActual ?? 0);
  const [gdtdA, setGdtdA] = useState(ev.gdtdActual ?? 0);
  const [dealsA, setDealsA] = useState(ev.dealsActual ?? 0);
  const [testDrivesA, setTestDrivesA] = useState(ev.testDrivesActual ?? 0);
  const [notes, setNotes] = useState(ev.notes ?? '');

  const budgetPct = ev.budget > 0 ? Math.round((spent / ev.budget) * 100) : 0;
  const convRate  = leadsA > 0 ? ((dealsA / leadsA) * 100).toFixed(1) : '—';

  const handleSave = () => {
    onSave({ ...ev, status: 'completed', budgetSpent: spent,
      leadsActual: leadsA, gdtdActual: gdtdA, dealsActual: dealsA, testDrivesActual: testDrivesA, notes });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ width: 580, maxWidth: '96vw', background: '#fff' }} onClick={e => e.stopPropagation()}>

        {/* Header — green variant */}
        <div className="modal-header-green">
          <h3 className="modal-title" style={{ color: '#15803d' }}>
            <FileCheck2 size={16} />Báo cáo kết thúc sự kiện
          </h3>
          <button className="modal-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="modal-body">

          {/* Event info */}
          <div style={{ background: '#f8fafc', borderRadius: 6, padding: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{ev.name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {ev.type} · {ev.showroom} · {ev.date} · {ev.location}
            </div>
          </div>

          {/* KPIs thực hiện — 5 chỉ tiêu */}
          <div>
            <label className="form-label-modal" style={{ marginBottom: 12 }}>Kết quả thực hiện</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>

              {/* NS thực chi */}
              <div>
                <label className="form-label-modal" style={{ color: 'var(--color-brand, #004B9B)' }}>
                  NS đã chi (Trđ) <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.budget}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    className="form-input-underline"
                    style={{ fontWeight: 700 }}
                    value={spent} onChange={e => setSpent(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 100 ? '#ef4444' : budgetPct > 85 ? '#f59e0b' : '#10b981', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: budgetPct > 100 ? '#dc2626' : '#64748b', textAlign: 'right', marginTop: 2 }}>{budgetPct}% KH</div>
                </div>
              </div>

              {/* KHQT thực */}
              <div>
                <label className="form-label-modal" style={{ color: '#3b82f6' }}>
                  KHQT thực <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.leads ?? '—'}</span>
                </label>
                <input type="number" min="0"
                  className="form-input-underline"
                  style={{ fontWeight: 600, color: '#3b82f6' }}
                  value={leadsA} onChange={e => setLeadsA(Number(e.target.value))} />
              </div>

              {/* GDTD thực */}
              <div>
                <label className="form-label-modal" style={{ color: '#f59e0b' }}>
                  GDTD thực <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.gdtd ?? '—'}</span>
                </label>
                <input type="number" min="0"
                  className="form-input-underline"
                  style={{ fontWeight: 600, color: '#f59e0b' }}
                  value={gdtdA} onChange={e => setGdtdA(Number(e.target.value))} />
              </div>

              {/* KHĐ thực */}
              <div>
                <label className="form-label-modal" style={{ color: '#10b981' }}>
                  KHĐ thực <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.deals ?? '—'}</span>
                </label>
                <input type="number" min="0"
                  className="form-input-underline"
                  style={{ fontWeight: 600, color: '#10b981' }}
                  value={dealsA} onChange={e => setDealsA(Number(e.target.value))} />
              </div>

              {/* Lái thử thực */}
              <div>
                <label className="form-label-modal" style={{ color: '#06b6d4' }}>
                  Lái thử thực <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.testDrives ?? '—'}</span>
                </label>
                <input type="number" min="0"
                  className="form-input-underline"
                  style={{ fontWeight: 600, color: '#06b6d4' }}
                  value={testDrivesA} onChange={e => setTestDrivesA(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Tóm tắt tự động */}
          {(spent > 0 || leadsA > 0) && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, border: '1px solid #bbf7d0', display: 'flex', gap: 20, fontSize: 12 }}>
              <div><span style={{ color: '#64748b' }}>CPL thực:</span> <strong style={{ color: '#059669' }}>{leadsA > 0 ? `${formatNumber(Math.round(spent / leadsA * 1_000_000))}đ` : '—'}</strong></div>
              <div><span style={{ color: '#64748b' }}>CR leads→HĐ:</span> <strong style={{ color: '#059669' }}>{convRate}%</strong></div>
              <div><span style={{ color: '#64748b' }}>Tiết kiệm NS:</span> <strong style={{ color: spent <= ev.budget ? '#059669' : '#dc2626' }}>{ev.budget - spent >= 0 ? '+' : ''}{formatNumber(ev.budget - spent)} tr</strong></div>
            </div>
          )}

          {/* Ghi chú */}
          <div>
            <label className="form-label-modal">Ghi chú / Nhận xét sau sự kiện</label>
            <textarea
              style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', minHeight: 64, color: 'var(--color-text)', fontFamily: 'inherit' }}
              value={notes} onChange={e => setNotes(e.target.value)} placeholder="Điểm mạnh, điểm yếu, bài học kinh nghiệm..." />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="button-erp-secondary" onClick={onClose}>Hủy bỏ</button>
          <button className="button-erp-primary" style={{ background: '#059669', borderColor: '#059669' }} onClick={handleSave}>
            <FileCheck2 size={13} style={{ marginRight: 6 }} />Xác nhận kết thúc
          </button>
        </div>
      </div>
    </div>
  );
}
