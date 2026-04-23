'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, MapPin, Plus, Edit2, Trash2, ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  showrooms?: ShowroomRow[];
}

interface ShowroomRow {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  is_active: boolean;
  brands: string[];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { effectiveIsSuperAdmin, effectiveRole, role, profile, isLoading: authLoading } = useAuth();
  const { brands: masterBrands } = useBrands();
  const { refreshShowrooms } = useShowrooms();
  const supabase = React.useMemo(() => createClient(), []);

  const [units, setUnits] = useState<UnitRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [unitModal, setUnitModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data?: Partial<UnitRow> }>({ open: false, mode: 'add' });
  const [showroomModal, setShowroomModal] = useState<{ open: boolean; mode: 'add' | 'edit'; unitId?: string; data?: Partial<ShowroomRow> }>({ open: false, mode: 'add' });

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitsRes, showroomsRes] = await Promise.all([
        supabase.from('thaco_units').select('*').order('code'),
        supabase.from('thaco_showrooms').select('*').order('code'),
      ]);
      if (unitsRes.error) throw unitsRes.error;
      if (showroomsRes.error) throw showroomsRes.error;

      const showrooms = (showroomsRes.data ?? []) as ShowroomRow[];
      let result = (unitsRes.data ?? [] as UnitRow[]).map((u: UnitRow) => ({
        ...u,
        showrooms: showrooms.filter(s => s.unit_id === u.id),
      }));
      if (!effectiveIsSuperAdmin && profile?.unit_id) result = result.filter(u => u.id === profile.unit_id);
      setUnits(result);
    } catch (e: any) {
      setError(e.message ?? 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [supabase, effectiveIsSuperAdmin, profile]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Unit CRUD ────────────────────────────────────────────────────────────

  const saveUnit = async () => {
    const d = unitModal.data ?? {};
    if (!d.code?.trim() || !d.name?.trim()) return;
    setSaving(true);
    try {
      if (unitModal.mode === 'add') {
        const { error } = await supabase.from('thaco_units').insert({ code: d.code.trim().toUpperCase(), name: d.name.trim(), is_active: true });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('thaco_units').update({ code: d.code!.trim().toUpperCase(), name: d.name!.trim(), is_active: d.is_active ?? true }).eq('id', d.id!);
        if (error) throw error;
      }
      setUnitModal({ open: false, mode: 'add' });
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleUnitActive = async (unit: UnitRow) => {
    await supabase.from('thaco_units').update({ is_active: !unit.is_active }).eq('id', unit.id);
    await loadData();
  };

  // ─── Showroom CRUD ────────────────────────────────────────────────────────

  const saveShowroom = async () => {
    const d = showroomModal.data ?? {};
    if (!d.code?.trim() || !d.name?.trim() || !showroomModal.unitId) return;
    setSaving(true);
    try {
      if (showroomModal.mode === 'add') {
        const { error } = await supabase.from('thaco_showrooms').insert({ unit_id: showroomModal.unitId, code: d.code.trim().toUpperCase(), name: d.name.trim(), brands: d.brands || [], is_active: true });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('thaco_showrooms').update({ code: d.code!.trim().toUpperCase(), name: d.name!.trim(), brands: d.brands || [], is_active: d.is_active ?? true }).eq('id', d.id!);
        if (error) throw error;
      }
      setShowroomModal({ open: false, mode: 'add' });
      await loadData();
      await refreshShowrooms();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleShowroomActive = async (sr: ShowroomRow) => {
    await supabase.from('thaco_showrooms').update({ is_active: !sr.is_active }).eq('id', sr.id);
    await loadData();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // Chờ auth load xong trước khi check quyền
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 10, color: '#64748b' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Đang kiểm tra quyền...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!effectiveIsSuperAdmin && effectiveRole !== 'bld' && effectiveRole !== 'pt_mkt_cty') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 10, color: '#dc2626' }}>
        <AlertCircle size={20} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Chỉ Super Admin hoặc Ban Giám Đốc mới có quyền truy cập trang này.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={22} style={{ color: '#2563eb' }} />
            Quản lý Công ty & Showroom
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Cấu hình cấu trúc tổ chức: Công ty con &rarr; Showroom
          </p>
        </div>
        <button
          className="button-erp-primary"
          style={{ display: effectiveIsSuperAdmin ? 'flex' : 'none', alignItems: 'center', gap: 6 }}
          onClick={() => setUnitModal({ open: true, mode: 'add', data: {} })}
        >
          <Plus size={15} /> Thêm công ty
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10, color: '#64748b' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Đang tải...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {units.map(unit => {
            const isExpanded = expanded.has(unit.id);
            return (
              <div key={unit.id} className="panel" style={{ overflow: 'hidden' }}>
                {/* Unit row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10, borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none', background: '#fafafa' }}>
                  <button
                    onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(unit.id) ? s.delete(unit.id) : s.add(unit.id); return s; })}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#64748b', display: 'flex' }}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <Building2 size={16} style={{ color: '#2563eb', flexShrink: 0 }} />

                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{unit.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>[{unit.code}]</span>
                  </div>

                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {unit.showrooms?.length ?? 0} showroom
                  </span>

                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    background: unit.is_active ? '#ecfdf5' : '#fef2f2',
                    color: unit.is_active ? '#059669' : '#dc2626',
                    border: `1px solid ${unit.is_active ? '#d1fae5' : '#fecaca'}`,
                    cursor: 'pointer',
                  }} onClick={() => toggleUnitActive(unit)}>
                    {unit.is_active ? 'Active' : 'Inactive'}
                  </span>

                  <button
                    className="button-erp-secondary"
                    style={{ padding: '5px', minWidth: 'unset', width: 28, height: 28 }}
                    onClick={() => setUnitModal({ open: true, mode: 'edit', data: { ...unit } })}
                  >
                    <Edit2 size={13} style={{ color: '#3b82f6' }} />
                  </button>
                </div>

                {/* Showrooms */}
                {isExpanded && (
                  <div style={{ padding: '8px 16px 12px 44px' }}>
                    {(unit.showrooms ?? []).length === 0 ? (
                      <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', margin: '8px 0' }}>Chưa có showroom</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                        <thead>
                          <tr>
                            <th style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'left', padding: '4px 8px', textTransform: 'uppercase' }}>Mã</th>
                            <th style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'left', padding: '4px 8px', textTransform: 'uppercase' }}>Tên Showroom</th>
                            <th style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'center', padding: '4px 8px', textTransform: 'uppercase' }}>Trạng thái</th>
                            <th style={{ width: 60 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(unit.showrooms ?? []).map(sr => (
                            <tr key={sr.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>{sr.code}</td>
                              <td style={{ padding: '6px 8px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MapPin size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                {sr.name}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                                  background: sr.is_active ? '#ecfdf5' : '#fef2f2',
                                  color: sr.is_active ? '#059669' : '#dc2626',
                                  border: `1px solid ${sr.is_active ? '#d1fae5' : '#fecaca'}`,
                                }} onClick={() => toggleShowroomActive(sr)}>
                                  {sr.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <button
                                  className="button-erp-secondary"
                                  style={{ padding: '4px', minWidth: 'unset', width: 26, height: 26 }}
                                  onClick={() => setShowroomModal({ open: true, mode: 'edit', unitId: unit.id, data: { ...sr } })}
                                >
                                  <Edit2 size={12} style={{ color: '#3b82f6' }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      className="button-erp-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                      onClick={() => setShowroomModal({ open: true, mode: 'add', unitId: unit.id, data: {} })}
                    >
                      <Plus size={13} /> Thêm showroom
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {units.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13 }}>Chưa có công ty nào. Nhấn "Thêm công ty" để bắt đầu.</div>
          )}
        </div>
      )}

      {/* ── Unit Modal ── */}
      {unitModal.open && (
        <ModalOverlay onClose={() => setUnitModal({ open: false, mode: 'add' })}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>
              {unitModal.mode === 'add' ? 'Thêm Công ty' : 'Sửa Công ty'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Mã <span style={{ color: '#dc2626' }}>*</span>
                <input
                  type="text"
                  value={unitModal.data?.code ?? ''}
                  onChange={e => setUnitModal(p => ({ ...p, data: { ...p.data, code: e.target.value } }))}
                  placeholder="VD: HN, HP, HD..."
                  style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Tên đầy đủ <span style={{ color: '#dc2626' }}>*</span>
                <input
                  type="text"
                  value={unitModal.data?.name ?? ''}
                  onChange={e => setUnitModal(p => ({ ...p, data: { ...p.data, name: e.target.value } }))}
                  placeholder="VD: THACO AUTO HÀ NỘI"
                  style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="button-erp-secondary" onClick={() => setUnitModal({ open: false, mode: 'add' })}>Hủy</button>
              <button className="button-erp-primary" onClick={saveUnit} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Showroom Modal ── */}
      {showroomModal.open && (
        <ModalOverlay onClose={() => setShowroomModal({ open: false, mode: 'add' })}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>
              {showroomModal.mode === 'add' ? 'Thêm Showroom' : 'Sửa Showroom'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Mã Showroom <span style={{ color: '#dc2626' }}>*</span>
                <input
                  type="text"
                  value={showroomModal.data?.code ?? ''}
                  onChange={e => setShowroomModal(p => ({ ...p, data: { ...p.data, code: e.target.value } }))}
                  placeholder="VD: PVD, GP, HM..."
                  style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Tên Showroom <span style={{ color: '#dc2626' }}>*</span>
                <input
                  type="text"
                  value={showroomModal.data?.name ?? ''}
                  onChange={e => setShowroomModal(p => ({ ...p, data: { ...p.data, name: e.target.value } }))}
                  placeholder="VD: Phạm Văn Đồng"
                  style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Hãng xe phân phối (Brands)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {masterBrands.map(b => (
                    <label key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showroomModal.data?.brands?.includes(b.name) || false}
                        onChange={(e) => {
                          const current = showroomModal.data?.brands || [];
                          const newBrands = e.target.checked
                            ? [...current, b.name]
                            : current.filter(x => x !== b.name);
                          setShowroomModal(p => ({ ...p, data: { ...p.data, brands: newBrands } }));
                        }}
                      />
                      <span style={{ color: '#374151', fontWeight: 500 }}>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="button-erp-secondary" onClick={() => setShowroomModal({ open: false, mode: 'add' })}>Hủy</button>
              <button className="button-erp-primary" onClick={saveShowroom} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
