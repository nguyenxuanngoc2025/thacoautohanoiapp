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
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 10, width: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid var(--color-border-dark)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #dcfce7)', padding: '14px 20px', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileCheck2 size={16} />Báo cáo kết thúc sự kiện
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Event info */}
          <div style={{ background: '#f8fafc', borderRadius: 6, padding: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{ev.name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {ev.type} · {ev.showroom} · {ev.date} · {ev.location}
            </div>
          </div>

          {/* KPIs thực hiện — 5 chỉ tiêu */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kết quả thực hiện</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
              {/* NS thực chi */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-brand, #004B9B)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>NS đã chi (Trđ) <span style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>/ KH: {ev.budget}</span></label>
                <div style={{ position: 'relative' }}>
                  <input type="number" min="0" style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 0', fontSize: 13, fontWeight: 700, outline: 'none', color: 'var(--color-text)' }} value={spent} onChange={e => setSpent(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 100 ? '#ef4444' : budgetPct > 85 ? '#f59e0b' : '#10b981', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: budgetPct > 100 ? '#dc2626' : '#64748b', textAlign: 'right', marginTop: 2 }}>{budgetPct}% KH</div>
                </div>
              </div>
              {/* KHQT thực */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>KHQT thực <span style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>/ KH: {ev.leads ?? '—'}</span></label>
                <input type="number" min="0" style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 0', fontSize: 13, fontWeight: 600, outline: 'none', color: '#3b82f6' }}
                  value={leadsA} onChange={e => setLeadsA(Number(e.target.value))} />
              </div>
              {/* GDTD thực */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GDTD thực <span style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>/ KH: {ev.gdtd ?? '—'}</span></label>
                <input type="number" min="0" style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 0', fontSize: 13, fontWeight: 600, outline: 'none', color: '#f59e0b' }}
                  value={gdtdA} onChange={e => setGdtdA(Number(e.target.value))} />
              </div>
              {/* KHĐ thực */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#10b981', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>KHĐ thực <span style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>/ KH: {ev.deals ?? '—'}</span></label>
                <input type="number" min="0" style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 0', fontSize: 13, fontWeight: 600, outline: 'none', color: '#10b981' }}
                  value={dealsA} onChange={e => setDealsA(Number(e.target.value))} />
              </div>
              {/* Lái thử thực */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#06b6d4', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lái thử thực <span style={{ fontWeight:400, color:'#94a3b8', fontSize:10 }}>/ KH: {ev.testDrives ?? '—'}</span></label>
                <input type="number" min="0" style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 0', fontSize: 13, fontWeight: 600, outline: 'none', color: '#06b6d4' }}
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
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ghi chú / Nhận xét sau sự kiện</label>
            <textarea style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', minHeight: 64, color: 'var(--color-text)', fontFamily: 'inherit' }}
              value={notes} onChange={e => setNotes(e.target.value)} placeholder="Điểm mạnh, điểm yếu, bài học kinh nghiệm..." />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="button-erp-secondary" onClick={onClose}>Hủy bỏ</button>
          <button className="button-erp-primary" style={{ background: '#059669', borderColor: '#059669' }} onClick={handleSave}>
            <FileCheck2 size={13} style={{ marginRight: 6 }} />Xác nhận kết thúc
          </button>
        </div>
      </div>
    </div>
  );
}
