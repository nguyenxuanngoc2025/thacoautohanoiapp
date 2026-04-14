'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Radio, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, GripVertical, Check, X, Folder } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelGroupRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface ChannelRow {
  id: string;
  code: string;
  name: string;
  group_id: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const PRESET_COLORS = [
  '#EA4335','#1877F2','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#0EA5E9','#14B8A6','#F97316','#64748B',
];

// ─── Inline Editors ───────────────────────────────────────────────────────────

function GroupEditor({ group, onSave, onCancel }: {
  group: Partial<ChannelGroupRow>;
  onSave: (data: Partial<ChannelGroupRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(group.name ?? '');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name });
    setSaving(false);
  };

  return (
    <div style={{
      background: '#fafafa', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 16
    }}>
      <Folder size={18} style={{ color: '#94a3b8' }} />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Tên nhóm kênh (Vd: Digital)"
        autoFocus
        style={{
          flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 600,
          border: '1px solid var(--color-border)', borderRadius: 6, outline: 'none',
          background: '#fff',
        }}
      />
      <button
        onClick={handle} disabled={saving || !name.trim()}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: 'none',
          background: saving || !name.trim() ? '#e2e8f0' : 'var(--color-brand)',
          color: saving || !name.trim() ? '#94a3b8' : '#fff',
          fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
        }}
      >
        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} Lưu
      </button>
      <button onClick={onCancel} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
        border: '1px solid var(--color-border)', background: '#fff',
        fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
      }}>
        <X size={13} /> Hủy
      </button>
    </div>
  );
}

function ChannelEditor({ channel, groups, onSave, onCancel }: {
  channel: Partial<ChannelRow>;
  groups: ChannelGroupRow[];
  onSave: (data: Partial<ChannelRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name:     channel.name ?? '',
    group_id: channel.group_id ?? (groups.length > 0 ? groups[0].id : null),
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
      background: '#fafafa', border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 160px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Tên kênh</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="Vd: TikTok Ads"
            autoFocus
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: '1px solid var(--color-border)', borderRadius: 6, outline: 'none', background: '#fff',
            }}
          />
        </div>

        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Thuộc nhóm</label>
          <select
            value={form.group_id ?? ''}
            onChange={e => setForm(f => ({ ...f, group_id: e.target.value || null }))}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: '1px solid var(--color-border)', borderRadius: 6, background: '#fff',
            }}
          >
            <option value="">-- Không có nhóm --</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Màu sắc</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{
                  width: 24, height: 24, borderRadius: 6, background: c, border: 'none',
                  outline: form.color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2, cursor: 'pointer', transition: 'outline 0.1s',
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
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none',
            background: saving || !form.name.trim() ? '#e2e8f0' : 'var(--color-brand)',
            color: saving || !form.name.trim() ? '#94a3b8' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} Lưu
        </button>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--color-border)', background: '#fff',
          fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
        }}>
          <X size={13} /> Hủy
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { isSuperAdmin } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<ChannelGroupRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for adding
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);

  // States for editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [gRes, cRes] = await Promise.all([
      supabase.from('thaco_master_channel_groups').select('*').order('sort_order'),
      supabase.from('thaco_master_channels').select('*').order('sort_order')
    ]);
    if (gRes.error) { setError(gRes.error.message); setLoading(false); return; }
    if (cRes.error) { setError(cRes.error.message); setLoading(false); return; }
    if (gRes.data) setGroups(gRes.data);
    if (cRes.data) setChannels(cRes.data);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // supabase client stable via useMemo — safe to omit

  useEffect(() => { load(); }, [load]);

  // ─── Group Handlers
  const handleAddGroup = async (form: Partial<ChannelGroupRow>) => {
    const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) : 0;
    const code = form.name!.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('thaco_master_channel_groups').insert({
      code: `${code}_${Date.now()}`,
      name: form.name,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    if (error) setError(error.message);
    else { setShowAddGroup(false); load(); }
  };

  const handleUpdateGroup = async (id: string, form: Partial<ChannelGroupRow>) => {
    const { error } = await supabase.from('thaco_master_channel_groups')
      .update({ name: form.name, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setError(error.message);
    else { setEditingGroupId(null); load(); }
  };

  const handleToggleGroup = async (group: ChannelGroupRow) => {
    await supabase.from('thaco_master_channel_groups')
      .update({ is_active: !group.is_active, updated_at: new Date().toISOString() }).eq('id', group.id);
    load();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Xóa nhóm kênh này? Các kênh bên trong sẽ tự động chuyển thành "Không thuộc nhóm".')) return;
    await supabase.from('thaco_master_channel_groups').delete().eq('id', id);
    load();
  };

  // ─── Channel Handlers
  const handleAddChannel = async (form: Partial<ChannelRow>) => {
    const maxOrder = channels.length > 0 ? Math.max(...channels.map(c => c.sort_order)) : 0;
    const code = form.name!.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('thaco_master_channels').insert({
      code: `${code}_${Date.now()}`,
      name: form.name,
      group_id: form.group_id,
      color: form.color,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    if (error) setError(error.message);
    else { setShowAddChannel(false); load(); }
  };

  const handleUpdateChannel = async (id: string, form: Partial<ChannelRow>) => {
    const { error } = await supabase.from('thaco_master_channels')
      .update({ name: form.name, group_id: form.group_id, color: form.color, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setError(error.message);
    else { setEditingChannelId(null); load(); }
  };

  const handleToggleChannel = async (ch: ChannelRow) => {
    await supabase.from('thaco_master_channels')
      .update({ is_active: !ch.is_active, updated_at: new Date().toISOString() }).eq('id', ch.id);
    load();
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Xóa kênh này? Các dự liệu đã cấu hình với kênh này sẽ bị mất thông tin liên kết.')) return;
    await supabase.from('thaco_master_channels').delete().eq('id', id);
    load();
  };

  // ─── Render Helpers
  const renderChannel = (ch: ChannelRow) => {
    if (editingChannelId === ch.id) {
      return (
        <ChannelEditor
          key={ch.id}
          channel={ch}
          groups={groups}
          onSave={(form) => handleUpdateChannel(ch.id, form)}
          onCancel={() => setEditingChannelId(null)}
        />
      );
    }
    return (
      <div key={ch.id} style={{
        background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: ch.is_active ? 1 : 0.5,
        transition: 'opacity 0.2s',
      }}>
        <GripVertical size={14} style={{ color: '#cbd5e1', flexShrink: 0, cursor: 'grab' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{ch.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Code: {ch.code}</div>
        </div>
        {!ch.is_active && (
           <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>[Đã Ẩn]</span>
        )}
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => handleToggleChannel(ch)} title={ch.is_active ? 'Ẩn' : 'Hiện'} style={{
              padding: 6, borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer',
            }}>
              {ch.is_active ? <ToggleRight size={16} style={{ color: 'var(--color-brand)' }} /> : <ToggleLeft size={16} color="var(--color-text-muted)" />}
            </button>
            <button onClick={() => setEditingChannelId(ch.id)} style={{
              padding: 6, borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer',
            }}>
              <Edit2 size={14} color="var(--color-text)" />
            </button>
            <button onClick={() => handleDeleteChannel(ch.id)} style={{
              padding: 6, borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer',
            }}>
              <Trash2 size={14} color="var(--color-text-muted)" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (group: ChannelGroupRow) => {
    const groupChannels = channels.filter(c => c.group_id === group.id);
    
    return (
      <div key={group.id} style={{
        background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: '16px',
        opacity: group.is_active ? 1 : 0.6,
      }}>
        {editingGroupId === group.id ? (
          <GroupEditor
            group={group}
            onSave={(f) => handleUpdateGroup(group.id, f)}
            onCancel={() => setEditingGroupId(null)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Folder size={18} style={{ color: group.is_active ? 'var(--color-brand)' : '#94a3b8' }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase' }}>
                {group.name}
              </h3>
              {!group.is_active && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>[Nhóm đã ẩn]</span>
              )}
            </div>
            {isSuperAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleToggleGroup(group)} title={group.is_active ? 'Ẩn nhóm' : 'Hiện nhóm'} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex'
                }}>
                  {group.is_active ? <ToggleRight size={18} style={{ color: 'var(--color-brand)' }} /> : <ToggleLeft size={18} color="var(--color-text-muted)" />}
                </button>
                <button onClick={() => setEditingGroupId(group.id)} title="Sửa nhóm" style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex'
                }}>
                  <Edit2 size={15} color="var(--color-text-muted)" />
                </button>
                <button onClick={() => handleDeleteGroup(group.id)} title="Xóa nhóm" style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex'
                }}>
                  <Trash2 size={15} color="var(--color-text-muted)" />
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12, borderLeft: '2px solid #f1f5f9' }}>
          {groupChannels.length > 0 ? (
            groupChannels.map(renderChannel)
          ) : (
             <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: 8 }}>Chưa có kênh nào trong nhóm này</div>
          )}
        </div>
      </div>
    );
  };

  const orphanedChannels = channels.filter(c => !c.group_id);

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={20} style={{ color: 'var(--color-brand)' }} />
            Cấu hình Kênh Marketing
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Quản lý linh hoạt danh sách Kênh và Nhóm Kênh
          </p>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowAddGroup(true); setEditingGroupId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7,
                background: '#fff', color: 'var(--color-text)', border: '1px solid var(--color-border)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Folder size={14} /> Thêm Nhóm
            </button>
            <button
              onClick={() => { setShowAddChannel(true); setEditingChannelId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7,
                background: 'var(--color-brand)', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Thêm Kênh
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* ── Add Forms ── */}
      {showAddGroup && (
        <GroupEditor
          group={{}}
          onSave={handleAddGroup}
          onCancel={() => setShowAddGroup(false)}
        />
      )}
      {showAddChannel && (
        <div style={{ marginBottom: 16 }}>
          <ChannelEditor
            channel={{}}
            groups={groups}
            onSave={handleAddChannel}
            onCancel={() => setShowAddChannel(false)}
          />
        </div>
      )}

      {/* ── Data List ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang tải dữ liệu...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Groups */}
          {groups.map(renderGroup)}
          
          {/* Orphaned Channels (if any) */}
          {orphanedChannels.length > 0 && (
            <div style={{
              background: '#fafafa', border: '1px dashed var(--color-border)',
              borderRadius: 12, padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Folder size={18} style={{ color: '#94a3b8' }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Không thuộc nhóm nào
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12, borderLeft: '2px solid #e2e8f0' }}>
                {orphanedChannels.map(renderChannel)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
