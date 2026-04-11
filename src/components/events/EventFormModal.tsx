'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, CalendarDays, X, ChevronDown } from 'lucide-react';
import {
  type EventItem,
  type EventPriority,
  EVENT_TYPES,
  PRIORITIES,
  deriveKpis
} from '@/lib/events-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1',
  background: 'transparent', padding: '4px 0', fontSize: 13,
  fontWeight: 500, outline: 'none', color: 'var(--color-text)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const fieldStyle: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center' };

// ─── SimpleSelect ──────────────────────────────────────────────────────────────
function SimpleSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', padding: '4px 20px 4px 0', fontSize: 13, fontWeight: 500, outline: 'none', color: 'var(--color-text)', cursor: 'pointer', appearance: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
    </div>
  );
}

// ─── Modal Props ───────────────────────────────────────────────────────────────
export interface EventFormModalProps {
  isNew: boolean;
  initialData: EventItem;
  fixedShowroom?: string; // If provided, showroom is non-editable
  onClose: () => void;
  onSave: (ev: EventItem) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function EventFormModal({ isNew, initialData, fixedShowroom, onClose, onSave }: EventFormModalProps) {
  const { brands: DEMO_BRANDS } = useBrands(); // Dynamic brands from DB
  const { showrooms, showroomNames } = useShowrooms();    // Dynamic showrooms from DB
  const [data, setData] = useState<EventItem>({ ...initialData });
  const [manualKpi, setManualKpi] = useState<Record<string, boolean>>({});
  
  const setManual = (k: string) => setManualKpi(p => ({ ...p, [k]: true }));
  const preview = deriveKpis(data.budget || 0);

  useEffect(() => {
    setData(d => ({
      ...d,
      leads:      manualKpi.leads      ? d.leads      : preview.leads,
      gdtd:       manualKpi.gdtd       ? d.gdtd       : preview.gdtd,
      deals:      manualKpi.deals      ? d.deals      : preview.deals,
      testDrives: manualKpi.testDrives ? d.testDrives : 0, // testDrives luôn bằng 0 mặc định khi tạo mới trừ khi nhập tay
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.budget]);

  const set = (patch: Partial<EventItem>) => setData(d => ({ ...d, ...patch }));

  const handleSave = () => {
    if (!data.name.trim()) return alert('Thiếu tên sự kiện');
    if (!data.date) return alert('Chưa chọn ngày');
    if (data.brands.length === 0) return alert('Chưa chọn thương hiệu / dòng xe');
    if (data.budget <= 0) return alert('Ngân sách phải > 0');
    onSave(data);
  };

  const toggleBrand = (bName: string, models: string[]) => {
    if (data.brands.includes(bName)) {
      set({ brands: data.brands.filter(b => b !== bName && !models.includes(b)) });
    } else {
      set({ brands: [...data.brands, bName] });
    }
  };

  const toggleModel = (m: string) => {
    set({ brands: data.brands.includes(m) ? data.brands.filter(b => b !== m) : [...data.brands, m] });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 10, width: 820, maxWidth: '96vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid var(--color-border-dark)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={15} color="var(--color-brand, #004B9B)" />
            {isNew ? 'Thêm sự kiện mới' : 'Chỉnh sửa sự kiện'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={15} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          {/* Row 1: Tên + Loại + Ngày */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Tên sự kiện / Chiến dịch</label>
              <div style={fieldStyle}>
                <input style={{...inputStyle, paddingRight: 24}} value={data.name} onChange={e => set({ name: e.target.value })} placeholder="VD: Lái thử xe cuối tuần" autoFocus />
                <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Loại hình</label>
              <SimpleSelect value={data.type} options={EVENT_TYPES} onChange={v => set({ type: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ngày bắt đầu</label>
              <input 
                type="date" 
                style={inputStyle} 
                value={
                  data.date 
                    ? (data.date.includes('/') 
                        ? data.date.split('/').reverse().join('-') 
                        : data.date) 
                    : ''
                } 
                onChange={e => set({ date: e.target.value })} 
              />
            </div>
          </div>

          {/* Row 2: Đơn vị + Địa điểm + Người phụ trách + Ưu tiên */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Đơn vị / Showroom</label>
              {fixedShowroom ? (
                <div style={fieldStyle}>
                   <input style={{ ...inputStyle, color: '#94a3b8' }} value={fixedShowroom} disabled />
                </div>
              ) : (
                <SimpleSelect value={data.showroom} options={showroomNames} onChange={v => set({ showroom: v })} />
              )}
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Địa điểm dự kiến</label>
              <div style={fieldStyle}>
                <input style={{...inputStyle, paddingRight: 24}} value={data.location} onChange={e => set({ location: e.target.value })} placeholder="VD: Vincom Trần Duy Hưng" />
                <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Người phụ trách</label>
              <input style={inputStyle} value={data.owner || ''} onChange={e => set({ owner: e.target.value })} placeholder="Họ tên..." />
            </div>
            <div style={{ flex: 0.7 }}>
              <label style={labelStyle}>Ưu tiên</label>
              <SimpleSelect value={data.priority || 'medium'} options={PRIORITIES} onChange={v => set({ priority: v as EventPriority })} />
            </div>
          </div>

          {/* Thương hiệu */}
          <div>
            <label style={labelStyle}>Thương hiệu & Dòng xe áp dụng</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
              {(() => {
                const activeShowroom = showrooms.find(s => s.name === data.showroom);
                const allowedBrands = activeShowroom?.brands || [];
                // Nếu showroom chưa được setup brands nào (mảng rỗng), tạm cho hiển thị All để không lỗi UI. 
                // Nếu đã setup, CHỈ hiển thị đúng các brands được tick chọn!
                const visibleBrands = DEMO_BRANDS.filter(b => allowedBrands.length === 0 ? true : allowedBrands.includes(b.name));
                
                if (visibleBrands.length === 0) {
                  return <div style={{ fontSize: 13, color: '#dc2626' }}>Showroom này chưa được cấp phép Thương hiệu nào. Vui lòng liên hệ Admin.</div>;
                }

                return visibleBrands.map(b => (
                <div key={b.name}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, background: data.brands.includes(b.name) ? '#eff6ff' : '#fff', border: data.brands.includes(b.name) ? '1px solid #3b82f6' : '1px solid #cbd5e1', padding: '5px 10px', borderRadius: 4, transition: 'all 0.12s' }}>
                    <input type="checkbox" checked={data.brands.includes(b.name)} onChange={() => toggleBrand(b.name, b.models)} style={{ margin: 0, cursor: 'pointer' }} />
                    <span style={{ fontWeight: data.brands.includes(b.name) ? 600 : 400, color: data.brands.includes(b.name) ? '#1d4ed8' : '#334155' }}>Thương hiệu {b.name}</span>
                  </label>
                  {data.brands.includes(b.name) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 24, marginTop: 4 }}>
                      {b.models.map(m => (
                        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, padding: '2px 8px', background: data.brands.includes(m) ? '#e0e7ff' : 'transparent', borderRadius: 12, border: data.brands.includes(m) ? '1px solid #a5b4fc' : '1px solid #e2e8f0' }}>
                          <input type="checkbox" checked={data.brands.includes(m)} onChange={() => toggleModel(m)} style={{ margin: 0 }} />
                          <span style={{ color: data.brands.includes(m) ? '#4338ca' : '#64748b' }}>{m}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                ));
              })()}
            </div>
          </div>

          {/* KPI Grid: NS / KHQT / GDTD / KHĐ / Lái thử */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Ngân sách & Chỉ tiêu KPI kế hoạch</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>

              {/* Ngân sách */}
              <div>
                <label style={{ ...labelStyle, color: 'var(--color-brand, #004B9B)' }}>Ngân sách (Trđ)</label>
                <div style={fieldStyle}>
                  <input type="number" min="0" style={{ ...inputStyle, paddingRight: 20, textAlign: 'right', fontWeight: 700 }}
                    value={data.budget || ''}
                    onChange={e => set({ budget: Number(e.target.value) })}
                    placeholder="0" />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* KHQT */}
              <div>
                <label style={{ ...labelStyle, color: '#3b82f6' }}>KHQT</label>
                <div style={fieldStyle}>
                  <input type="number" min="0" style={{ ...inputStyle, paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}
                    value={manualKpi.leads ? (data.leads ?? 0) : preview.leads}
                    onChange={e => { setManual('leads'); set({ leads: Number(e.target.value) }); }}
                    onFocus={() => setManual('leads')} />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>
              
              {/* Lái thử */}
              <div>
                <label style={{ ...labelStyle, color: '#06b6d4' }}>Lái thử</label>
                <div style={fieldStyle}>
                  <input type="number" min="0" style={{ ...inputStyle, paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#06b6d4' }}
                    value={data.testDrives ?? 0}
                    onChange={e => { setManual('testDrives'); set({ testDrives: Number(e.target.value) }); }} />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* GDTD */}
              <div>
                <label style={{ ...labelStyle, color: '#f59e0b' }}>GDTD</label>
                <div style={fieldStyle}>
                  <input type="number" min="0" style={{ ...inputStyle, paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}
                    value={manualKpi.gdtd ? (data.gdtd ?? 0) : preview.gdtd}
                    onChange={e => { setManual('gdtd'); set({ gdtd: Number(e.target.value) }); }}
                    onFocus={() => setManual('gdtd')} />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* KHĐ */}
              <div>
                <label style={{ ...labelStyle, color: '#10b981' }}>KHĐ</label>
                <div style={fieldStyle}>
                  <input type="number" min="0" style={{ ...inputStyle, paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#10b981' }}
                    value={manualKpi.deals ? (data.deals ?? 0) : preview.deals}
                    onChange={e => { setManual('deals'); set({ deals: Number(e.target.value) }); }}
                    onFocus={() => setManual('deals')} />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 11, color: '#1d4ed8' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Nhập Ngân sách → KHQT/GDTD/KHĐ tự nhảy. Click vào ô bất kỳ để sửa thủ công.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--color-border)', padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>Hủy bỏ</button>
          <button onClick={handleSave} style={{ background: 'var(--color-brand, #004b9b)', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            {isNew ? 'Thêm mới' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
