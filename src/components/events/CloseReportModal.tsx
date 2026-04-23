import React, { useState } from 'react';
import { FileCheck2, X, ExternalLink, Edit } from 'lucide-react';
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
  const [reportLink, setReportLink] = useState(ev.reportLink ?? '');

  const isCompleted = ev.status === 'completed';
  const [isEditing, setIsEditing] = useState(!isCompleted);

  const isDirty = isEditing && (
    spent !== (ev.budgetSpent ?? 0) ||
    leadsA !== (ev.leadsActual ?? 0) ||
    gdtdA !== (ev.gdtdActual ?? 0) ||
    dealsA !== (ev.dealsActual ?? 0) ||
    testDrivesA !== (ev.testDrivesActual ?? 0) ||
    notes !== (ev.notes ?? '') ||
    reportLink !== (ev.reportLink ?? '')
  );

  const handleClose = () => {
    if (isDirty && !window.confirm('Bạn có thay đổi chưa lưu. Thoát mà không lưu?')) return;
    onClose();
  };

  const budgetPct = ev.budget > 0 ? Math.round((spent / ev.budget) * 100) : 0;
  const convRate  = leadsA > 0 ? ((dealsA / leadsA) * 100).toFixed(1) : '—';

  const leadsPct = ev.leads ? Math.round((leadsA / ev.leads) * 100) : 0;
  const gdtdPct = ev.gdtd ? Math.round((gdtdA / ev.gdtd) * 100) : 0;
  const dealsPct = ev.deals ? Math.round((dealsA / ev.deals) * 100) : 0;
  const testDrivesPct = ev.testDrives ? Math.round((testDrivesA / ev.testDrives) * 100) : 0;

  const getKpiColor = (pct: number) => {
    if (pct < 50) return '#ef4444';
    if (pct < 80) return '#f59e0b';
    return '#10b981';
  };

  const handleSave = () => {
    onSave({ ...ev, status: 'completed', budgetSpent: spent,
      leadsActual: leadsA, gdtdActual: gdtdA, dealsActual: dealsA, testDrivesActual: testDrivesA, notes, reportLink });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" style={{ width: 580, maxWidth: '96vw', background: '#fff' }} onClick={e => e.stopPropagation()}>

        {/* Header — green variant */}
        <div className="modal-header-green">
          <h3 className="modal-title" style={{ color: '#15803d' }}>
            <FileCheck2 size={16} />{isCompleted ? (isEditing ? 'Sửa Báo Cáo Kết Quả' : 'Xem Báo Cáo Kết Quả') : 'Báo cáo kết thúc sự kiện'}
          </h3>
          <button className="modal-close-btn" onClick={handleClose}><X size={15} /></button>
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
              <div style={{ display: 'flex', flexDirection: 'column', opacity: !isEditing ? 0.9 : 1 }}>
                <label className="form-label-modal" style={{ color: 'var(--color-brand, #004B9B)', minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>NS Thực chi (Trđ)</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.budget}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    disabled={!isEditing}
                    className="form-input-underline"
                    style={{ fontWeight: 700 }}
                    value={spent} onChange={e => setSpent(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 100 ? '#ef4444' : budgetPct > 85 ? '#f59e0b' : '#10b981', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: budgetPct > 100 ? '#dc2626' : '#64748b', textAlign: 'right', marginTop: 2 }}>{budgetPct}% KH</div>
                </div>
              </div>

              {/* KHQT Thực tế */}
              <div style={{ display: 'flex', flexDirection: 'column', opacity: !isEditing ? 0.9 : 1 }}>
                <label className="form-label-modal" style={{ color: '#3b82f6', minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>KHQT Thực tế</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.leads ?? '—'}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    disabled={!isEditing}
                    className="form-input-underline"
                    style={{ fontWeight: 600, color: '#3b82f6' }}
                    value={leadsA} onChange={e => setLeadsA(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(leadsPct, 100)}%`, background: getKpiColor(leadsPct), borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{leadsPct}% KH</div>
                </div>
              </div>

              {/* GDTD Thực tế */}
              <div style={{ display: 'flex', flexDirection: 'column', opacity: !isEditing ? 0.9 : 1 }}>
                <label className="form-label-modal" style={{ color: '#f59e0b', minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>GDTD Thực tế</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.gdtd ?? '—'}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    disabled={!isEditing}
                    className="form-input-underline"
                    style={{ fontWeight: 600, color: '#f59e0b' }}
                    value={gdtdA} onChange={e => setGdtdA(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(gdtdPct, 100)}%`, background: getKpiColor(gdtdPct), borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{gdtdPct}% KH</div>
                </div>
              </div>

              {/* KHĐ Thực tế */}
              <div style={{ display: 'flex', flexDirection: 'column', opacity: !isEditing ? 0.9 : 1 }}>
                <label className="form-label-modal" style={{ color: '#10b981', minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>KHĐ Thực tế</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.deals ?? '—'}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    disabled={!isEditing}
                    className="form-input-underline"
                    style={{ fontWeight: 600, color: '#10b981' }}
                    value={dealsA} onChange={e => setDealsA(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(dealsPct, 100)}%`, background: getKpiColor(dealsPct), borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{dealsPct}% KH</div>
                </div>
              </div>

              {/* Lái thử Thực tế */}
              <div style={{ display: 'flex', flexDirection: 'column', opacity: !isEditing ? 0.9 : 1 }}>
                <label className="form-label-modal" style={{ color: '#06b6d4', minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lái thử Thực tế</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>/ KH: {ev.testDrives ?? '—'}</span>
                </label>
                <div>
                  <input type="number" min="0"
                    disabled={!isEditing}
                    className="form-input-underline"
                    style={{ fontWeight: 600, color: '#06b6d4' }}
                    value={testDrivesA} onChange={e => setTestDrivesA(Number(e.target.value))} />
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(testDrivesPct, 100)}%`, background: getKpiColor(testDrivesPct), borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{testDrivesPct}% KH</div>
                </div>
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

          {/* Link Báo cáo */}
          <div style={{ opacity: !isEditing ? 0.9 : 1 }}>
            <label className="form-label-modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Link báo cáo chi tiết (Drive, Docs, Sheets...)</span>
              {reportLink && (
                <a href={reportLink.startsWith('http') ? reportLink : `https://${reportLink}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                  <ExternalLink size={11} /> Mở link
                </a>
              )}
            </label>
            <input type="text"
              disabled={!isEditing}
              className="form-input"
              value={reportLink} onChange={e => setReportLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              style={{ width: '100%', fontSize: 12, padding: '8px 10px', background: !isEditing ? '#f8fafc' : '#fff' }}
            />
          </div>

          {/* Ghi chú */}
          <div style={{ opacity: !isEditing ? 0.9 : 1 }}>
            <label className="form-label-modal">Ghi chú / Nhận xét sau sự kiện</label>
            <textarea
              disabled={!isEditing}
              style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', minHeight: 64, color: 'var(--color-text)', fontFamily: 'inherit', background: !isEditing ? '#f8fafc' : '#fff' }}
              value={notes} onChange={e => setNotes(e.target.value)} placeholder="Điểm mạnh, điểm yếu, bài học kinh nghiệm..." />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', display: 'flex', justifyContent: isEditing ? 'flex-end' : 'space-between' }}>
          {!isEditing ? (
            <>
              <div style={{ fontSize: 12, color: '#64748b' }}>Đang ở chế độ xem</div>
              <button className="button-erp-primary" onClick={() => setIsEditing(true)}>
                <Edit size={13} style={{ marginRight: 6 }} /> Chỉnh sửa báo cáo
              </button>
            </>
          ) : (
            <>
              <button className="button-erp-secondary" onClick={handleClose}>Huỷ bỏ</button>
              <button className="button-erp-primary" style={{ background: '#059669', borderColor: '#059669' }} onClick={handleSave}>
                <FileCheck2 size={13} style={{ marginRight: 6 }} />{isCompleted ? 'Lưu thay đổi' : 'Xác nhận kết thúc'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
