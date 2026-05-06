'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Search, Edit2, Loader2, X, Check, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  type ThacUser,
  type UserRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_SCOPE,
  ROLE_PERMISSIONS,
  ROLE_CAN,
  ROLE_CANNOT,
  ROLE_NEEDS,
  roleNeedsShowroom,
  roleNeedsBrands,
  roleIsAdmin,
  roleIsCompanyWide,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitRow { id: string; code: string; name: string; }
interface ShowroomRow { id: string; unit_id: string; code: string; name: string; is_active: boolean; }
interface BrandNameRow { name: string; }

const ROLE_COLOR: Record<UserRole, { bg: string; text: string; border: string }> = {
  super_admin:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  pt_mkt_cty:   { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  bld:          { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  gd_brand:     { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  gd_showroom:  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  mkt_brand:    { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  mkt_showroom: { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
  finance:      { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
};

// ─── Role Reference View ──────────────────────────────────────────────────────

function RoleReferenceView() {
  const roles = Object.keys(ROLE_LABELS) as UserRole[];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: '4px 0' }}>
      {roles.map(role => {
        const c = ROLE_COLOR[role];
        const can = ROLE_CAN[role];
        const cannot = ROLE_CANNOT[role];
        const needs = ROLE_NEEDS[role];
        return (
          <div key={role} style={{ border: `1.5px solid ${c.border}`, borderRadius: 10, background: '#fff', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Header */}
            <div style={{ background: c.bg, padding: '12px 16px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{ROLE_LABELS[role]}</div>
                <div style={{ fontSize: 11, color: c.text, opacity: 0.8, marginTop: 2 }}>{ROLE_DESCRIPTIONS[role]}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fff', color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap', marginLeft: 8 }}>
                {ROLE_SCOPE[role].split(' — ')[0]}
              </span>
            </div>
            {/* Body */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', minWidth: 72, paddingTop: 1 }}>Cần gán</span>
                <span style={{ fontSize: 11, color: '#374151' }}>{needs.label}</span>
              </div>
              {can.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', minWidth: 72, paddingTop: 2 }}>Được làm</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {can.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cannot.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', minWidth: 72, paddingTop: 2 }}>Không được</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {cannot.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  onSave: (updates: Partial<ThacUser> & { password?: string }) => Promise<void>;
  saving: boolean;
  saveError?: string | null;
}

function UserEditModal({ user, units, showrooms, allBrandNames, onClose, onSave, saving, saveError }: EditModalProps) {
  const isNew = !user.id;
  const [form, setForm] = useState<Partial<ThacUser>>({
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'mkt_showroom',
    unit_id: user.unit_id ?? null,
    showroom_id: user.showroom_id ?? null,
    showroom_ids: user.showroom_ids ?? [],
    brands: user.brands ?? [],
    is_active: user.is_active ?? true,
  });
  const [password, setPassword] = useState('thaco123');

  const toggleShowroomCode = (code: string) => {
    setForm(f => {
      const current = f.showroom_ids ?? [];
      return { ...f, showroom_ids: current.includes(code) ? current.filter(c => c !== code) : [...current, code] };
    });
  };

  const role = form.role!;
  const needsShowroom = roleNeedsShowroom(role);
  const needsBrands = roleNeedsBrands(role);
  const isGlobal = roleIsCompanyWide(role);  // super_admin, bld, finance
  const isPtMkt  = role === 'pt_mkt_cty';    // cần gán unit nhưng xem toàn cty

  // Chỉ hiện showroom sau khi đã chọn đơn vị — tránh hiện toàn bộ danh sách
  const filteredShowrooms = form.unit_id
    ? showrooms.filter(s => s.unit_id === form.unit_id && s.is_active)
    : [];

  // pt_mkt_cty: không cần showroom, nhưng cần unit; tương tự bld nhưng scoped
  const needsUnit = !isGlobal; // tất cả trừ super_admin, bld, finance

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
      showroom_ids: roleNeedsShowroom(r) ? (f.showroom_ids ?? []) : [],
      brands: roleNeedsBrands(r) ? f.brands : [],
      unit_id: roleIsCompanyWide(r) ? null : f.unit_id,
    }));
  };

  return (
    <ModalOverlay onClose={onClose}>
      {/* Modal rộng, 2 cột */}
      <div style={{ background: '#fff', borderRadius: 8, width: 820, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} style={{ color: '#2563eb' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {user.id ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
            </h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        {/* Layout 2 cột */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 0, minHeight: 400 }}>

          {/* ── CỘT TRÁI: Thông tin cơ bản ── */}
          <div style={{ padding: '20px 24px', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Thông tin tài khoản
            </div>

            {/* Họ tên */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
              Họ và tên <span style={{ color: '#dc2626', display: 'inline' }}>*</span>
              <input type="text" value={form.full_name ?? ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none' }} />
            </label>

            {/* Email + Password — chỉ khi thêm mới */}
            {isNew && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  Email <span style={{ color: '#dc2626', display: 'inline' }}>*</span>
                  <input type="text" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@thaco.com.vn"
                    style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none' }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  Mật khẩu ban đầu <span style={{ color: '#dc2626', display: 'inline' }}>*</span>
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="thaco123"
                    style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
                </label>
              </>
            )}

            {/* Đơn vị — nếu cần */}
            {needsUnit && (
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
                Đơn vị (Công ty) {!needsBrands && <span style={{ color: '#dc2626', display: 'inline' }}>*</span>}
                <select value={form.unit_id ?? ''} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value || null, showroom_id: null }))}
                  style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none' }}>
                  <option value="">-- Chọn đơn vị --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                </select>
                {isPtMkt && (
                  <span style={{ fontSize: 10, color: '#9d174d', fontStyle: 'italic' }}>
                    PT MKT Cty chỉ xem được dữ liệu công ty này
                  </span>
                )}
              </label>
            )}

            {/* Showroom — multi-select (Phase 1 Bottom-Up) */}
            {needsShowroom && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Showroom được giao <span style={{ color: '#dc2626' }}>*</span>
                  <span style={{ fontSize: 10, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                    (chọn nhiều — user thấy dữ liệu của các SR này)
                  </span>
                </div>
                {!form.unit_id && (
                  <span style={{ fontSize: 10, color: '#f59e0b' }}>Chọn đơn vị trước để lọc showroom</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 8px' }}>
                  {filteredShowrooms.length === 0 && (
                    <span style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>Không có showroom nào</span>
                  )}
                  {filteredShowrooms.map(s => (
                    <label key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '2px 0' }}>
                      <input
                        type="checkbox"
                        checked={(form.showroom_ids ?? []).includes(s.code)}
                        onChange={() => toggleShowroomCode(s.code)}
                        style={{ width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 12 }}>{s.name}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{s.code}</span>
                    </label>
                  ))}
                </div>
                {(form.showroom_ids ?? []).length === 0 && (
                  <span style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Chưa chọn showroom nào</span>
                )}
              </div>
            )}

            {/* Brands */}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 4 }}>
              <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              Tài khoản đang hoạt động
            </label>
          </div>

          {/* ── CỘT PHẢI: Chọn Vai trò ── */}
          <div style={{ padding: '20px 24px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Vai trò & Phân quyền <span style={{ color: '#dc2626' }}>*</span>
            </div>

            {/* Summary box khi đã chọn role */}
            {form.role && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: ROLE_COLOR[form.role].bg, border: `1px solid ${ROLE_COLOR[form.role].border}`, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR[form.role].text, marginBottom: 3 }}>Cần gán khi tạo tài khoản này:</div>
                <div style={{ fontSize: 11, color: '#374151' }}>{ROLE_NEEDS[form.role].label}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 480 }}>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => {
                const c = ROLE_COLOR[r];
                const active = form.role === r;
                const permissions = ROLE_PERMISSIONS[r] ?? [];
                return (
                  <label key={r} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.border : '#e5e7eb'}`,
                    background: active ? c.bg : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="role" value={r} checked={active} onChange={() => handleRoleChange(r)} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Role name + đặc trưng */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: active ? c.text : '#374151' }}>
                          {ROLE_LABELS[r]}
                        </span>
                        {r === 'super_admin' && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', letterSpacing: '0.05em' }}>
                            SYSTEM WIDE
                          </span>
                        )}
                        {r === 'pt_mkt_cty' && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#fce7f3', color: '#9d174d', border: '1px solid #fbcfe8', letterSpacing: '0.05em' }}>
                            COMPANY ADMIN
                          </span>
                        )}
                      </div>

                      {/* Mô tả ngắn */}
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {ROLE_DESCRIPTIONS[r]}
                      </div>

                      {/* Phạm vi */}
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <span style={{ fontWeight: 600, color: '#d1d5db', flexShrink: 0 }}>Phạm vi:</span>
                        <span>{ROLE_SCOPE[r]}</span>
                      </div>

                      {/* Quyền hạn — chỉ hiện khi selected */}
                      {active && permissions.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {permissions.map(p => (
                            <span key={p} style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 10,
                              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                            }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f1f5f9', background: '#fff' }}>
          {saveError && (
            <div style={{ padding: '10px 24px', background: '#fef2f2', borderBottom: '1px solid #fca5a5', fontSize: 12.5, color: '#dc2626' }}>
              {saveError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, padding: '14px 24px', justifyContent: 'flex-end' }}>
            <button className="button-erp-secondary" onClick={onClose}>Hủy</button>
            <button className="button-erp-primary" onClick={() => onSave(isNew ? { ...form, password } : form)} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { effectiveIsSuperAdmin: isSuperAdmin, effectiveRole, profile: myProfile } = useAuth();
  const canManageUsers = isSuperAdmin || effectiveRole === 'pt_mkt_cty';
  const supabase = React.useMemo(() => createClient(), []);

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
  const [activeTab, setActiveTab] = useState<'list' | 'roles'>('list');

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // pt_mkt_cty chỉ thấy user trong cùng công ty
      let usersQuery = supabase.from('thaco_users').select(`*, unit:thaco_units(*), showroom:thaco_showrooms(*)`).order('full_name');
      if (effectiveRole === 'pt_mkt_cty' && myProfile?.unit_id) {
        usersQuery = usersQuery.eq('unit_id', myProfile.unit_id);
      }

      const [usersRes, unitsRes, showroomsRes, brandsRes] = await Promise.all([
        usersQuery,
        supabase.from('thaco_units').select('id, code, name').order('code'),
        supabase.from('thaco_showrooms').select('id, unit_id, code, name, is_active').order('code'),
        supabase.from('thaco_master_brands').select('name').eq('is_active', true).order('sort_order'),
      ]);
      if (usersRes.error) throw usersRes.error;
      setUsers((usersRes.data ?? []) as ThacUser[]);
      setUnits((unitsRes.data ?? []) as UnitRow[]);
      setShowrooms((showroomsRes.data ?? []) as ShowroomRow[]);
      setAllBrandNames(((brandsRes.data ?? []) as BrandNameRow[]).map(b => b.name));
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [supabase, effectiveRole, myProfile?.unit_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async (updates: Partial<ThacUser> & { password?: string }) => {
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
        const res = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editModal.user.id, ...updates }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Loi cap nhat tai khoan');
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
        {canManageUsers && (
          <button className="button-erp-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setEditModal({ open: true, user: {} })}>
            <Plus size={15} /> Thêm tài khoản
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0' }}>
        {(['list', 'roles'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13,
            fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? '#2563eb' : '#64748b',
            background: 'transparent',
            borderBottom: `2px solid ${activeTab === tab ? '#2563eb' : 'transparent'}`,
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            {tab === 'list' ? 'Danh sách tài khoản' : 'Loại tài khoản & Phân quyền'}
          </button>
        ))}
      </div>

      {activeTab === 'roles' ? (
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Mỗi loại tài khoản có bộ quyền cố định theo quy trình nghiệp vụ. Khi tạo tài khoản mới, chọn đúng loại và gán phạm vi theo hướng dẫn bên dưới.
          </p>
          <RoleReferenceView />
        </div>
      ) : (
      <>

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
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Họ tên & Email</th>
                <th style={{ width: '20%' }}>Đơn vị</th>
                <th style={{ width: '12%' }}>Vai trò</th>
                <th style={{ width: '24%' }}>Showroom / Thương hiệu</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Trạng thái</th>
                {canManageUsers && <th style={{ width: '8%', textAlign: 'center' }}>Thao tác</th>}
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
                      {roleNeedsShowroom(user.role) && (() => {
                        const codes = user.showroom_ids ?? [];
                        if (codes.length > 0) {
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {codes.map(code => {
                                const sr = showrooms.find(s => s.code === code);
                                return (
                                  <span key={code} title={sr?.name ?? code} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', fontFamily: 'monospace', fontWeight: 600 }}>
                                    {code}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }
                        if (user.showroom) {
                          return <span>{user.showroom.name} <span style={{ color: '#94a3b8' }}>({user.showroom.code})</span></span>;
                        }
                        return <span style={{ fontSize: 11, color: '#ef4444', fontStyle: 'italic' }}>Chưa gán SR</span>;
                      })()}
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
                    {canManageUsers && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button 
                            className="button-erp-secondary" 
                            title="Đổi mật khẩu"
                            style={{ padding: '5px', minWidth: 'unset', width: 28, height: 28 }}
                            onClick={async () => {
                              const newPass = prompt(`Nhập mật khẩu mới cho ${user.full_name}:`);
                              if (!newPass) return;
                              if (newPass.length < 6) return alert('Mật khẩu quá ngắn');
                              
                              try {
                                const res = await fetch('/api/admin/reset-password', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.id, newPassword: newPass })
                                });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json.error);
                                alert('Đã cấp lại mật khẩu thành công');
                              } catch(e: any) {
                                alert(e.message || 'Lỗi cấp lại mật khẩu');
                              }
                            }}
                          >
                            <ShieldCheck size={13} style={{ color: '#059669' }} />
                          </button>
                          <button className="button-erp-secondary" style={{ padding: '5px', minWidth: 'unset', width: 28, height: 28 }}
                            onClick={() => setEditModal({ open: true, user })}>
                            <Edit2 size={13} style={{ color: '#3b82f6' }} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canManageUsers ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
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
          onClose={() => { setEditModal(null); setError(null); }}
          onSave={handleSave}
          saving={saving}
          saveError={error}
        />
      )}
      </>
      )}
    </div>
  );
}
