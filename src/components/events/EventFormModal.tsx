'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Edit2, CalendarDays, X, ChevronDown } from 'lucide-react';
import {
  type EventItem,
  type EventPriority,
  EVENT_TYPES,
  PRIORITIES,
  deriveKpis,
  EVENT_CPL,
  EVENT_CR1,
  EVENT_CR2
} from '@/lib/events-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';

// ─── SimpleSelect ──────────────────────────────────────────────────────────────
function SimpleSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="form-input-underline"
        style={{ paddingRight: 20, cursor: 'pointer', appearance: 'none' }}
      >
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
  fixedShowroom?: string;
  onClose: () => void;
  onSave: (ev: EventItem) => Promise<void> | void;
  onNavigateToReport?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function EventFormModal({ isNew, initialData, fixedShowroom, onClose, onSave, onNavigateToReport }: EventFormModalProps) {
  const { brands: DEMO_BRANDS } = useBrands();
  const { showrooms, showroomNames } = useShowrooms();
  const [data, setData] = useState<EventItem>({ ...initialData });
  const [manualKpi, setManualKpi] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Allocation table state ────────────────────────────────────────────────
  type ModelAlloc = { brand: string; model: string; pct: number; budget: number; leads: number; gdtd: number; deals: number };
  const [allocations, setAllocations] = useState<ModelAlloc[]>([]);
  const [allocManual, setAllocManual] = useState<Record<string, Set<string>>>({}); // model -> set of manual fields

  const setManual = (k: string) => setManualKpi(p => ({ ...p, [k]: true }));
  const preview = deriveKpis(data.budget || 0);

  // Extract selected models from brands[]
  const selectedModels = useMemo(() => {
    const brandNameSet = new Set(DEMO_BRANDS.map(b => b.name));
    return data.brands.filter(b => !brandNameSet.has(b));
  }, [data.brands, DEMO_BRANDS]);

  const modelToBrand = useMemo(() => {
    const map: Record<string, string> = {};
    DEMO_BRANDS.forEach(b => {
      const models = (b.modelData ?? b.models.map(n => ({ name: n }))).map(m => m.name);
      models.forEach(m => { map[m] = b.name; });
    });
    return map;
  }, [DEMO_BRANDS]);

  // Recalculate allocations when models / budget change
  useEffect(() => {
    if (selectedModels.length === 0) {
      setAllocations([]);
      // Fallback: use old top-level logic
      setData(d => ({
        ...d,
        leads:      manualKpi.leads      ? d.leads      : preview.leads,
        gdtd:       manualKpi.gdtd       ? d.gdtd       : preview.gdtd,
        deals:      manualKpi.deals      ? d.deals      : preview.deals,
        testDrives: manualKpi.testDrives ? d.testDrives : 0,
      }));
      return;
    }

    const totalBudget = data.budget || 0;
    const count = selectedModels.length;
    // Always recalculate equal distribution when model set changes
    // so that adding/removing a model keeps totals at 100%
    const basePct = count > 0 ? Math.floor(100 / count) : 100;
    const leftoverPct = 100 - basePct * count;

    setAllocations(prev => {
      // Check if the model set changed (vs prev)
      const prevModels = prev.map(a => a.model);
      const sameModels = prevModels.length === count && selectedModels.every(m => prevModels.includes(m));

      const newAlloc: ModelAlloc[] = selectedModels.map((model, idx) => {
        const existing = prev.find(a => a.model === model);
        const manualFields = allocManual[model] || new Set();

        // If model set hasn't changed, preserve existing pct; otherwise reset to equal split
        const pct = (sameModels && existing)
          ? existing.pct
          : basePct + (idx === 0 ? leftoverPct : 0);

        const modelBudget = Math.round((totalBudget * pct / 100) * 10) / 10;
        return {
          brand: modelToBrand[model] || '',
          model,
          pct,
          budget: modelBudget,
          leads:  manualFields.has('leads')  ? (existing?.leads ?? 0)  : Math.round(modelBudget / EVENT_CPL),
          gdtd:   manualFields.has('gdtd')   ? (existing?.gdtd ?? 0)   : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1),
          deals:  manualFields.has('deals')  ? (existing?.deals ?? 0)  : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1 * EVENT_CR2),
        };
      });
      return newAlloc;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.budget, selectedModels.join(','), modelToBrand]);

  // Sync allocation totals back to event data
  useEffect(() => {
    if (allocations.length === 0) return;
    const totals = allocations.reduce((acc, a) => ({
      leads: acc.leads + a.leads,
      gdtd: acc.gdtd + a.gdtd,
      deals: acc.deals + a.deals,
    }), { leads: 0, gdtd: 0, deals: 0 });
    setData(d => ({ ...d, leads: totals.leads, gdtd: totals.gdtd, deals: totals.deals }));
  }, [allocations]);

  const updateAlloc = useCallback((idx: number, field: keyof ModelAlloc, value: number) => {
    setAllocations(prev => {
      const next = [...prev];
      const totalBudget = data.budget || 0;

      if (field === 'pct') {
        // Clamp the changed value to [0, 100]
        const newPct = Math.min(100, Math.max(0, value));
        const others = next.filter((_, i) => i !== idx);
        const remaining = Math.max(0, 100 - newPct);

        return next.map((a, i) => {
          if (i === idx) {
            const modelBudget = Math.round((totalBudget * newPct / 100) * 10) / 10;
            const manualFields = allocManual[a.model] || new Set();
            return {
              ...a,
              pct: newPct,
              budget: modelBudget,
              leads: manualFields.has('leads') ? a.leads : Math.round(modelBudget / EVENT_CPL),
              gdtd:  manualFields.has('gdtd')  ? a.gdtd  : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1),
              deals: manualFields.has('deals') ? a.deals : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1 * EVENT_CR2),
            };
          }
          // Redistribute remaining % evenly among other rows
          if (others.length === 0) return a;
          const otherPos = others.findIndex(o => o.model === a.model);
          const perOther = Math.floor(remaining / others.length);
          const leftover = remaining - perOther * others.length;
          const assignedPct = perOther + (otherPos === 0 ? leftover : 0);
          const modelBudget = Math.round((totalBudget * assignedPct / 100) * 10) / 10;
          const manualFields = allocManual[a.model] || new Set();
          return {
            ...a,
            pct: assignedPct,
            budget: modelBudget,
            leads: manualFields.has('leads') ? a.leads : Math.round(modelBudget / EVENT_CPL),
            gdtd:  manualFields.has('gdtd')  ? a.gdtd  : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1),
            deals: manualFields.has('deals') ? a.deals : Math.round((modelBudget / EVENT_CPL) * EVENT_CR1 * EVENT_CR2),
          };
        });
      }

      if (field === 'leads' || field === 'gdtd' || field === 'deals') {
        const row = { ...next[idx] };
        (row as any)[field] = value;
        setAllocManual(prev => {
          const updated = { ...prev };
          const s = new Set(updated[row.model] || []);
          s.add(field);
          updated[row.model] = s;
          return updated;
        });
        next[idx] = row;
        return next;
      }

      return next;
    });
  }, [data.budget, allocManual]);

  const set = (patch: Partial<EventItem>) => { setErrorMsg(null); setData(d => ({ ...d, ...patch })); };

  const handleSave = async () => {
    // Inline validation — KHÔNG dùng alert() vì browser có thể block
    if (!data.name.trim())           { setErrorMsg('Thiếu tên sự kiện'); return; }
    if (!data.date)                  { setErrorMsg('Chưa chọn ngày tổ chức'); return; }
    if (!data.showroom || data.showroom === 'all' || data.showroom === 'Tất cả') {
      setErrorMsg('Sự kiện phải thuộc 1 showroom cụ thể'); return;
    }
    if (!data.showroom_code || data.showroom_code === 'all') {
      setErrorMsg('Không xác định được mã showroom. Vui lòng chọn lại Đơn vị / Showroom.'); return;
    }
    if (data.brands.length === 0)    { setErrorMsg('Chưa chọn thương hiệu / dòng xe'); return; }
    if ((data.budget ?? 0) <= 0)     { setErrorMsg('Ngân sách phải > 0'); return; }

    const selectableEventBrands = DEMO_BRANDS.filter(brand => !/^DVPT\b/i.test(brand.name));
    const invalidBrandSelections = selectableEventBrands
      .filter(brand => data.brands.includes(brand.name))
      .filter(brand => {
        const selectableModels = (brand.modelData ?? brand.models.map(name => ({ name, is_aggregate: false, aggregate_group: null })))
          .filter(model => !model.is_aggregate)
          .map(model => model.name);
        return !selectableModels.some(model => data.brands.includes(model));
      });
    if (invalidBrandSelections.length > 0) {
      setErrorMsg(`Phải chọn ít nhất 1 model cụ thể cho: ${invalidBrandSelections.map(brand => brand.name).join(', ')}`);
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      console.log('[EventFormModal] Gọi onSave...', data);
      await Promise.race([
        onSave(data),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout kết nối Supabase sau 30s')), 30000))
      ]);
      console.log('[EventFormModal] Đã lưu thành công!');
    } catch (err: unknown) {
      console.error('[EventFormModal] onSave error:', err);
      setErrorMsg(`Lưu thất bại: ${(err as any)?.message || 'Lỗi hệ thống'}. Mở console xem chi tiết.`);
    } finally {
      setSaving(false);
    }
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ width: 820, maxWidth: '96vw' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <CalendarDays size={15} color="var(--color-brand, #004B9B)" />
            {isNew ? 'Thêm sự kiện mới' : 'Chỉnh sửa sự kiện'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Row 1: Tên + Loại + Ngày */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <label className="form-label-modal">Tên sự kiện / Chiến dịch</label>
              <div className="form-field-row">
                <input
                  className="form-input-underline"
                  style={{ paddingRight: 24 }}
                  value={data.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="VD: Lái thử xe cuối tuần"
                  autoFocus
                />
                <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label-modal">Loại hình</label>
              <SimpleSelect value={data.type} options={EVENT_TYPES} onChange={v => set({ type: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label-modal">Ngày bắt đầu</label>
              <input
                type="date"
                className="form-input-underline"
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
              <label className="form-label-modal">Đơn vị / Showroom</label>
              {fixedShowroom ? (
                <div className="form-field-row">
                  <input className="form-input-underline" style={{ color: '#94a3b8' }} value={fixedShowroom} disabled />
                </div>
              ) : (
                <div>
                  <SimpleSelect
                    value={data.showroom}
                    options={showroomNames}
                    onChange={v => {
                      const sr = showrooms.find(s => s.name === v);
                      if (!sr) { setErrorMsg(`Không tìm thấy showroom "${v}". Vui lòng liên hệ Admin.`); return; }
                      set({ showroom: v, showroom_code: sr.code });
                    }}
                  />
                  {data.showroom_code && (
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, paddingLeft: 2 }}>
                      Mã: <strong>{data.showroom_code}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 2 }}>
              <label className="form-label-modal">Địa điểm dự kiến</label>
              <div className="form-field-row">
                <input
                  className="form-input-underline"
                  style={{ paddingRight: 24 }}
                  value={data.location}
                  onChange={e => set({ location: e.target.value })}
                  placeholder="VD: Vincom Trần Duy Hưng"
                />
                <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label-modal">Người phụ trách</label>
              <input className="form-input-underline" value={data.owner || ''} onChange={e => set({ owner: e.target.value })} placeholder="Họ tên..." />
            </div>
            <div style={{ flex: 0.7 }}>
              <label className="form-label-modal">Ưu tiên</label>
              <SimpleSelect value={data.priority || 'medium'} options={PRIORITIES} onChange={v => set({ priority: v as EventPriority })} />
            </div>
          </div>

          {/* Thương hiệu */}
          <div>
            <label className="form-label-modal">Thương hiệu & Dòng xe áp dụng</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
              {(() => {
                const activeShowroom = showrooms.find(s => s.name === data.showroom);
                const allowedBrands = activeShowroom?.brands || [];
                const visibleBrands = DEMO_BRANDS.filter(b => !/^DVPT\b/i.test(b.name))
                  .filter(b => allowedBrands.length === 0 ? true : allowedBrands.includes(b.name));
                
                if (visibleBrands.length === 0) {
                  return <div style={{ fontSize: 13, color: '#dc2626' }}>Showroom này chưa được cấp phép Thương hiệu nào. Vui lòng liên hệ Admin.</div>;
                }

                return visibleBrands.map(b => {
                  const selectableModels = (b.modelData ?? b.models.map(name => ({ name, is_aggregate: false, aggregate_group: null })))
                    .filter(model => !model.is_aggregate)
                    .map(model => model.name);

                  return (
                  <div key={b.name}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, background: data.brands.includes(b.name) ? '#eff6ff' : '#fff', border: data.brands.includes(b.name) ? '1px solid #3b82f6' : '1px solid #cbd5e1', padding: '5px 10px', borderRadius: 4, transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={data.brands.includes(b.name)} onChange={() => toggleBrand(b.name, b.models)} style={{ margin: 0, cursor: 'pointer' }} />
                      <span style={{ fontWeight: data.brands.includes(b.name) ? 600 : 400, color: data.brands.includes(b.name) ? '#1d4ed8' : '#334155' }}>Thương hiệu {b.name}</span>
                    </label>
                    {data.brands.includes(b.name) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 24, marginTop: 4 }}>
                        {selectableModels.map(m => (
                          <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, padding: '2px 8px', background: data.brands.includes(m) ? '#e0e7ff' : 'transparent', borderRadius: 12, border: data.brands.includes(m) ? '1px solid #a5b4fc' : '1px solid #e2e8f0' }}>
                            <input type="checkbox" checked={data.brands.includes(m)} onChange={() => toggleModel(m)} style={{ margin: 0 }} />
                            <span style={{ color: data.brands.includes(m) ? '#4338ca' : '#64748b' }}>{m}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )});
              })()}
            </div>
          </div>

          {/* KPI Grid: NS + Lái thử (always visible) */}
          <div>
            <label className="form-label-modal" style={{ marginBottom: 8 }}>Ngân sách & Chỉ tiêu KPI kế hoạch</label>
            <div style={{ display: 'grid', gridTemplateColumns: allocations.length > 0 ? '1fr 1fr' : '1fr 1fr 1fr 1fr 1fr', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>

              {/* Ngân sách */}
              <div>
                <label className="form-label-modal" style={{ color: 'var(--color-brand, #004B9B)' }}>Ngân sách tổng (Trđ)</label>
                <div className="form-field-row">
                  <input type="number" min="0"
                    className="form-input-underline"
                    style={{ paddingRight: 20, textAlign: 'right', fontWeight: 700 }}
                    value={data.budget || ''}
                    onChange={e => set({ budget: Number(e.target.value) })}
                    placeholder="0" />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Lái thử */}
              <div>
                <label className="form-label-modal" style={{ color: '#06b6d4' }}>Lái thử</label>
                <div className="form-field-row">
                  <input type="number" min="0"
                    className="form-input-underline"
                    style={{ paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#06b6d4' }}
                    value={data.testDrives ?? 0}
                    onChange={e => { setManual('testDrives'); set({ testDrives: Number(e.target.value) }); }} />
                  <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Show inline KPI only when NO allocation table */}
              {allocations.length === 0 && (
                <>
                  <div>
                    <label className="form-label-modal" style={{ color: '#3b82f6' }}>KHQT</label>
                    <div className="form-field-row">
                      <input type="number" min="0" className="form-input-underline" style={{ paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}
                        value={manualKpi.leads ? (data.leads ?? 0) : preview.leads}
                        onChange={e => { setManual('leads'); set({ leads: Number(e.target.value) }); }}
                        onFocus={() => setManual('leads')} />
                      <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label-modal" style={{ color: '#f59e0b' }}>GDTD</label>
                    <div className="form-field-row">
                      <input type="number" min="0" className="form-input-underline" style={{ paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}
                        value={manualKpi.gdtd ? (data.gdtd ?? 0) : preview.gdtd}
                        onChange={e => { setManual('gdtd'); set({ gdtd: Number(e.target.value) }); }}
                        onFocus={() => setManual('gdtd')} />
                      <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label-modal" style={{ color: '#10b981' }}>KHĐ</label>
                    <div className="form-field-row">
                      <input type="number" min="0" className="form-input-underline" style={{ paddingRight: 20, textAlign: 'right', fontWeight: 600, color: '#10b981' }}
                        value={manualKpi.deals ? (data.deals ?? 0) : preview.deals}
                        onChange={e => { setManual('deals'); set({ deals: Number(e.target.value) }); }}
                        onFocus={() => setManual('deals')} />
                      <Edit2 size={12} style={{ position: 'absolute', right: 0, color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Allocation Table — shown when models are selected */}
            {allocations.length > 0 && (
              <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#eff6ff', fontSize: 12, fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                  Phân bổ ngân sách theo dòng xe
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>Dòng xe</th>
                        <th style={{ width: 65, textAlign: 'center', padding: '8px 6px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>%</th>
                        <th style={{ width: 80, textAlign: 'right', padding: '8px 6px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: 'var(--color-brand, #004B9B)' }}>NS (Trđ)</th>
                        <th style={{ width: 70, textAlign: 'right', padding: '8px 6px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#3b82f6' }}>KHQT</th>
                        <th style={{ width: 70, textAlign: 'right', padding: '8px 6px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#f59e0b' }}>GDTD</th>
                        <th style={{ width: 70, textAlign: 'right', padding: '8px 6px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#10b981' }}>KHĐ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((alloc, idx) => (
                        <tr key={alloc.model} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 4 }}>{alloc.brand}</span>
                            <span style={{ fontWeight: 600 }}>{alloc.model}</span>
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <input type="number" min="0" max="100"
                              style={{ width: '100%', textAlign: 'center', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 2px', background: '#fff' }}
                              value={alloc.pct}
                              onChange={e => updateAlloc(idx, 'pct', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--color-brand, #004B9B)' }}>
                            {alloc.budget.toFixed(1)}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" min="0"
                              style={{ width: '100%', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#3b82f6', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 4px', background: (allocManual[alloc.model]?.has('leads')) ? '#eff6ff' : '#fff' }}
                              value={alloc.leads}
                              onChange={e => updateAlloc(idx, 'leads', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" min="0"
                              style={{ width: '100%', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#f59e0b', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 4px', background: (allocManual[alloc.model]?.has('gdtd')) ? '#fffbeb' : '#fff' }}
                              value={alloc.gdtd}
                              onChange={e => updateAlloc(idx, 'gdtd', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" min="0"
                              style={{ width: '100%', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#10b981', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 4px', background: (allocManual[alloc.model]?.has('deals')) ? '#ecfdf5' : '#fff' }}
                              value={alloc.deals}
                              onChange={e => updateAlloc(idx, 'deals', Number(e.target.value))} />
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bfdbfe' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12 }}>TỔNG CỘNG</td>
                        <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: allocations.reduce((s, a) => s + a.pct, 0) === 100 ? '#059669' : '#dc2626' }}>
                          {allocations.reduce((s, a) => s + a.pct, 0)}%
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--color-brand, #004B9B)' }}>
                          {allocations.reduce((s, a) => s + a.budget, 0).toFixed(1)}
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                          {allocations.reduce((s, a) => s + a.leads, 0)}
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                          {allocations.reduce((s, a) => s + a.gdtd, 0)}
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          {allocations.reduce((s, a) => s + a.deals, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 11, color: '#1d4ed8' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              {allocations.length > 0
                ? 'Điều chỉnh % phân bổ hoặc sửa trực tiếp KHQT/GDTD/KHĐ từng dòng xe. Tổng tự động cập nhật.'
                : 'Nhập Ngân sách → KHQT/GDTD/KHĐ tự nhảy. Click vào ô bất kỳ để sửa thủ công.'}
            </div>
          </div>
        </div>

        {/* Inline error message — không dùng alert() */}
        {errorMsg && (
          <div style={{
            margin: '0 20px 0',
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            fontSize: 13,
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {errorMsg}
          </div>
        )}

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            {!isNew && onNavigateToReport && initialData.status !== 'completed' && (
              <button 
                className="button-erp-primary" 
                style={{ background: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }} 
                onClick={() => { onClose(); onNavigateToReport(); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Điền Báo Cáo KQ
              </button>
            )}
            {!isNew && onNavigateToReport && initialData.status === 'completed' && (
              <button 
                className="button-erp-primary" 
                style={{ background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }} 
                onClick={() => { onClose(); onNavigateToReport(); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Xem Báo Cáo
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="button-erp-secondary" onClick={onClose} disabled={saving}>Hủy bỏ</button>
            <button
              className="button-erp-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Đang lưu...
                </>
              ) : (
                isNew ? 'Thêm mới' : 'Lưu thay đổi'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
