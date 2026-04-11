'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Radio, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, GripVertical, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelRow {
  id: string;
  code: string;
  name: string;
  category: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'DIGITAL',    label: 'Digital' },
  { value: 'SỰ KIỆN',  label: 'Sự kiện' },
  { value: 'CSKH',       label: 'CSKH' },
  { value: 'NHẬN DIỆN', label: 'Nhận diện / Branding' },
  { value: 'KHÁC',      label: 'Khác' },
];

const PRESET_COLORS = [
  '#EA4335','#1877F2','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#0EA5E9','#14B8A6','#F97316','#64748B',
];

// ─── Inline Editor ────────────────────────────────────────────────────────────

function ChannelEditor({ channel, onSave, onCancel }: {
  channel: Partial<ChannelRow>;
  onSave: (data: Partial<ChannelRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name:     channel.name ?? '',
    category: channel.category ?? 'DIGITAL',
    color:    channel.color ?? '#64748B',
  });
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{
      background: '#f0f9ff', border: '1px solid #bae6fd',
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Name */}
        <div style={{ flex: '2 1 160px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tên kênh</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="Vd: TikTok Ads"
            autoFocus
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: '1px solid #93c5fd', borderRadius: 6, outline: 'none',
              background: '#fff', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category */}
        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Nhóm</label>
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: '1px solid #93c5fd', borderRadius: 6, background: '#fff',
              boxSizing: 'border-box',
            }}
          >
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Color */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Màu</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{
                  width: 24, height: 24, borderRadius: 6, background: c, border: 'none',
                  outline: form.color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2, cursor: 'pointer',
                  transition: 'outline 0.1s',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handle} disabled={saving || !form.name.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: saving || !form.name.trim() ? '#e2e8f0' : '#2563eb',
            color: saving || !form.name.trim() ? '#94a3b8' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
          Lưu
        </button>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 6,
          border: '1px solid #e2e8f0', background: '#fff',
          fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
        }}>
          <X size={13} /> Hủy
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { isSuperAdmin } = useAuth();
  const supabase = createClient();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('thaco_master_channels')
      .select('*')
      .order('sort_order');
    if (!error && data) setChannels(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (form: Partial<ChannelRow>) => {
    const maxOrder = channels.length > 0 ? Math.max(...channels.map(c => c.sort_order)) : 0;
    const code = form.name!.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('thaco_master_channels').insert({
      code: `${code}_${Date.now()}`,
      name: form.name,
      category: form.category,
      color: form.color,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    if (error) { setError(error.message); return; }
    setShowAdd(false);
    await load();
  };

  const handleUpdate = async (id: string, form: Partial<ChannelRow>) => {
    const { error } = await supabase.from('thaco_master_channels')
      .update({ name: form.name, category: form.category, color: form.color, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { setError(error.message); return; }
    setEditingId(null);
    await load();
  };

  const handleToggle = async (ch: ChannelRow) => {
    await supabase.from('thaco_master_channels')
      .update({ is_active: !ch.is_active, updated_at: new Date().toISOString() })
      .eq('id', ch.id);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa kênh này? Dữ liệu ngân sách cũ vẫn giữ nguyên.')) return;
    await supabase.from('thaco_master_channels').delete().eq('id', id);
    await load();
  };

  const grouped = channels.reduce<Record<string, ChannelRow[]>>((acc, ch) => {
    if (!acc[ch.category]) acc[ch.category] = [];
    acc[ch.category].push(ch);
    return acc;
  }, {});

  return (
    <div style={{ padding: 28, maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={20} style={{ color: '#2563eb' }} />
            Cấu hình Kênh Marketing
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Quản lý danh sách kênh hiển thị trong bảng Ngân sách và Thực hiện
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 7,
              background: '#2563eb', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Thêm kênh
          </button>
        )}
      </div>

      {/* ── Info Banner ── */}
      <div style={{
        background: '#fff7ed', border: '1px solid #fed7aa',
        borderRadius: 10, padding: '12px 16px',
        fontSize: 12, color: '#92400e',
        display: 'flex', gap: 8,
      }}>
        <Radio size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Lưu ý:</strong> Các kênh này hiển thị trong bảng nhập liệu Ngân sách &amp; Thực hiện. Tắt kênh sẽ ẩn khỏi giao diện nhưng không xóa dữ liệu cũ. Đổi tên kênh sẽ ảnh hưởng hiển thị nhưng không phá dữ liệu lưu trữ.
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* ── Add Form ── */}
      {showAdd && (
        <ChannelEditor
          channel={{}}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* ── Channels List ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang tải...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              {/* Group Label */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ height: 1, background: '#e2e8f0', flex: 1 }} />
                {category}
                <div style={{ height: 1, background: '#e2e8f0', flex: 1 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(ch => (
                  <div key={ch.id}>
                    {editingId === ch.id ? (
                      <ChannelEditor
                        channel={ch}
                        onSave={(form) => handleUpdate(ch.id, form)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div style={{
                        background: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: 9, padding: '11px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        opacity: ch.is_active ? 1 : 0.5,
                        transition: 'opacity 0.2s',
                      }}>
                        {/* Drag handle (visual only) */}
                        <GripVertical size={14} style={{ color: '#cbd5e1', flexShrink: 0, cursor: 'grab' }} />

                        {/* Color dot + Name */}
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: ch.color, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{ch.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Code: {ch.code}</div>
                        </div>

                        {/* Status badge */}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: ch.is_active ? '#d1fae5' : '#f1f5f9',
                          color: ch.is_active ? '#059669' : '#94a3b8',
                        }}>
                          {ch.is_active ? 'Đang dùng' : 'Tắt'}
                        </span>

                        {/* Actions (super_admin only) */}
                        {isSuperAdmin && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleToggle(ch)} title={ch.is_active ? 'Tắt kênh' : 'Bật kênh'} style={{
                              padding: 6, borderRadius: 6, border: '1px solid #e2e8f0',
                              background: '#fff', cursor: 'pointer', display: 'flex',
                            }}>
                              {ch.is_active
                                ? <ToggleRight size={16} style={{ color: '#10b981' }} />
                                : <ToggleLeft size={16} style={{ color: '#94a3b8' }} />}
                            </button>
                            <button onClick={() => setEditingId(ch.id)} style={{
                              padding: 6, borderRadius: 6, border: '1px solid #e2e8f0',
                              background: '#fff', cursor: 'pointer', display: 'flex',
                            }}>
                              <Edit2 size={14} style={{ color: '#475569' }} />
                            </button>
                            <button onClick={() => handleDelete(ch.id)} style={{
                              padding: 6, borderRadius: 6, border: '1px solid #fee2e2',
                              background: '#fff5f5', cursor: 'pointer', display: 'flex',
                            }}>
                              <Trash2 size={14} style={{ color: '#ef4444' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
