'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Search, Edit2, Loader2, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  type ThacUser,
  type UserRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  roleNeedsShowroom,
  roleNeedsBrands,
  roleIsAdmin,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitRow { id: string; code: string; name: string; }
interface ShowroomRow { id: string; unit_id: string; code: string; name: string; is_active: boolean; }

const ROLE_COLOR: Record<UserRole, { bg: string; text: string; border: string }> = {
  super_admin:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  bld:          { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  gd_showroom:  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  mkt_brand:    { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  mkt_showroom: { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
  finance:      { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
};

// ─── Modal overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ─── User Edit Modal ──────────────────────────────────────────────────────────

interface EditModalProps {
  user: Partial<ThacUser> & { id?: string };
  units: UnitRow[];
  showrooms: ShowroomRow[];
  allBrandNames: string[];
  onClose: () => void;
  onSave: (updates: Partial<ThacUser>) => Promise<void>;
  saving: boolean;
}

function UserEditModal({ user, units, showrooms, allBrandNames, onClose, onSave, saving }: EditModalProps) {
  const [form, setForm] = useState<Partial<ThacUser>>({
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'mkt_showroom',
    unit_id: user.unit_id ?? null,
    showroom_id: user.showroom_id ?? null,
    brands: user.brands ?? [],
    is_active: user.is_active ?? true,
  });

  const role = form.role!;
  const needsShowroom = roleNeedsShowroom(role);
  const needsBrands = roleNeedsBrands(role);
  const isGlobal = roleIsAdmin(role) || role === 'finance';

  const filteredShowrooms = form.unit_id
    ? showrooms.filter(s => s.unit_id === form.unit_id && s.is_active)
    : showrooms.filter(s => s.is_active);

  const toggleBrand = (b: string) => {
    setForm(f => {
      const current = f.brands ?? [];
      return { ...f, brands: current.includes(b) ? current.filter(x => x !== b) : [...current, b] };
    });
  };

  const handleRoleChange = (r: UserRole) => {
    setForm(f => ({
      ...f, role: r,
      // Reset khi đổi role
      showroom_id: roleNeedsShowroom(r) ? f.showroom_id : null,
      brands: roleNeedsBrands(r) ? f.brands : [],
      unit_id: (roleIsAdmin(r) || r === 'finance') ? null : f.unit_id,
    }));
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {user.id ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Họ tên */}
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Họ và tên <span style={{ color: '#dc2626' }}>*</span>
            <input type="text" value={form.full_name ?? ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
          </label>

          {/* Email — chỉ show khi thêm mới */}
          {!user.id && (
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Email <span style={{ color: '#dc2626' }}>*</span>
              <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="ten@thaco.vn"
                style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
            </label>
          )}

          {/* Role */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Vai trò <span style={{ color: '#dc2626' }}>*</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => {
                const c = ROLE_COLOR[r];
                const active = form.role === r;
                return (
                  <label key={r} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.border : '#e5e7eb'}`,
                    background: active ? c.bg : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="role" value={r} checked={active} onChange={() => handleRoleChange(r)} style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? c.text : '#374151' }}>{ROLE_LABELS[r]}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{ROLE_DESCRIPTIONS[r]}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Đơn vị (công ty) — nếu không phải global */}
          {!isGlobal && (
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Đơn vị (Công ty) {!needsBrands && <span style={{ color: '#dc2626' }}>*</span>}
              <select value={form.unit_id ?? ''} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value || null, showroom_id: null }))}
                style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, background: '#fff', boxSizing: 'border-box' }}>
                <option value="">-- Chọn đơn vị --</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
              </select>
            </label>
          )}

          {/* Showroom — chỉ khi role cần */}
          {needsShowroom && (
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Showroom <span style={{ color: '#dc2626' }}>*</span>
              <select value={form.showroom_id ?? ''} onChange={e => setForm(f => ({ ...f, showroom_id: e.target.value || null }))}
                style={{ display: 'block', width: '100%', padding: '7px 10px', marginTop: 4, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, background: '#fff', boxSizing: 'border-box' }}>
                <option value="">-- Chọn showroom --</option>
                {filteredShowrooms.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
              {!form.unit_id && <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 3, display: 'block' }}>Chọn đơn vị trước để lọc showroom</span>}
            </label>
          )}

          {/* Brands — chỉ khi mkt_brand */}
          {needsBrands && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Thương hiệu được phụ trách
                <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginLeft: 6 }}>(bỏ trống = tất cả)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allBrandNames.map(b => {
                  const sel = (form.brands ?? []).includes(b);
                  return (
                    <button key={b} type="button" onClick={() => toggleBrand(b)} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${sel ? '#2563eb' : '#d1d5db'}`,
                      background: sel ? '#eff6ff' : '#fff', color: sel ? '#1d4ed8' : '#64748b',
                      display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
                    }}>
                      {sel && <Check size={11} />} {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trạng thái */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>
            <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Tài khoản đang hoạt động
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="button-erp-secondary" onClick={onClose}>Hủy</button>
          <button className="button-erp-primary" onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { isSuperAdmin, profile: myProfile } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<ThacUser[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [showrooms, setShowrooms] = useState<ShowroomRow[]>([]);
  const [allBrandNames, setAllBrandNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [editModal, setEditModal] = useState<{ open: boolean; user: Partial<ThacUser> & { id?: string } } | null>(null);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, unitsRes, showroomsRes, brandsRes] = await Promise.all([
        supabase.from('thaco_users').select(`*, unit:thaco_units(*), showroom:thaco_showrooms(*)`).order('full_name'),
        supabase.from('thaco_units').select('id, code, name').order('code'),
        supabase.from('thaco_showrooms').select('id, unit_id, code, name, is_active').order('code'),
        supabase.from('thaco_master_brands').select('name').eq('is_active', true).order('sort_order'),
      ]);
      if (usersRes.error) throw usersRes.error;
      setUsers((usersRes.data ?? []) as ThacUser[]);
      setUnits((unitsRes.data ?? []) as UnitRow[]);
      setShowrooms((showroomsRes.data ?? []) as ShowroomRow[]);
      setAllBrandNames((brandsRes.data ?? []).map((b: any) => b.name));
    } catch (e: any) {
      setError(e.message ?? 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async (updates: Partial<ThacUser>) => {
    setSaving(true);
    setError(null);
    try {
      if (!editModal?.user.id) {
        // Thêm mới: gọi Supabase Admin API thông qua route
        const res = await fetch('/api/admin/invite-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Lỗi tạo tài khoản');
      } else {
        // Cập nhật profile
        const { error } = await supabase.from('thaco_users').update({
          full_name: updates.full_name,
          role: updates.role,
          unit_id: updates.unit_id,
          showroom_id: updates.showroom_id,
          brands: updates.brands ?? [],
          is_active: updates.is_active,
        }).eq('id', editModal.user.id);
        if (error) throw error;
      }
      setSuccess('Đã lưu thành công');
      setEditModal(null);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filtered = users.filter(u => {
    const matchSearch = !searchTerm || u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUnit = !filterUnit || u.unit_id === filterUnit;
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchUnit && matchRole;
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} style={{ color: '#2563eb' }} />
            Quản lý Tài khoản & Phân quyền
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Phân quyền theo cấu trúc: Công ty &rarr; Showroom &rarr; Thương hiệu
          </p>
        </div>
        {isSuperAdmin && (
          <button className="button-erp-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setEditModal({ open: true, user: {} })}>
            <Plus size={15} /> Thêm tài khoản
          </button>
        )}
      </div>

      {/* Toast */}
      {success && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {success}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar" style={{ display: 'flex', gap: 12, padding: '12px 16px', background: '#fff', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input type="text" placeholder="Tìm email, tên..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, background: '#fff', outline: 'none' }}>
          <option value="">Tất cả Đơn vị</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, background: '#fff', outline: 'none' }}>
          <option value="">Tất cả Vai trò</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>{filtered.length} tài khoản</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10, color: '#64748b' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Đang tải...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Họ tên & Email</th>
                <th style={{ width: '20%' }}>Đơn vị</th>
                <th style={{ width: '12%' }}>Vai trò</th>
                <th style={{ width: '24%' }}>Showroom / Thương hiệu</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Trạng thái</th>
                {isSuperAdmin && <th style={{ width: '6%', textAlign: 'center' }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const c = ROLE_COLOR[user.role];
                const isSelf = user.id === myProfile?.id;
                return (
                  <tr key={user.id} style={{ background: isSelf ? '#fffbeb' : undefined }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, border: `1px solid ${c.border}`, flexShrink: 0 }}>
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {user.full_name}
                            {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: '#f59e0b', fontWeight: 700 }}>Bạn</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {user.unit ? (
                        <span style={{ fontSize: 12 }}>{user.unit.name} <span style={{ color: '#94a3b8' }}>({user.unit.code})</span></span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Tất cả công ty</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#374151' }}>
                      {user.showroom && (
                        <span>{user.showroom.name} <span style={{ color: '#94a3b8' }}>({user.showroom.code})</span></span>
                      )}
                      {roleNeedsBrands(user.role) && (
                        user.brands && user.brands.length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {user.brands.map(b => (
                                <span key={b} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{b}</span>
                              ))}
                            </div>
                          : <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Tất cả thương hiệu</span>
                      )}
                      {roleIsAdmin(user.role) && <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Toàn quyền xem</span>}
                      {user.role === 'finance' && <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Báo cáo tài chính</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: user.is_active ? '#ecfdf5' : '#fef2f2',
                        color: user.is_active ? '#059669' : '#dc2626',
                      }}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        <button className="button-erp-secondary" style={{ padding: '5px', minWidth: 'unset', width: 28, height: 28 }}
                          onClick={() => setEditModal({ open: true, user })}>
                          <Edit2 size={13} style={{ color: '#3b82f6' }} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Không tìm thấy tài khoản nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal?.open && (
        <UserEditModal
          user={editModal.user}
          units={units}
          showrooms={showrooms}
          allBrandNames={allBrandNames}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
