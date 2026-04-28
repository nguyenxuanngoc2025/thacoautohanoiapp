'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, GripVertical,
  ChevronDown, ChevronRight, RefreshCw, AlertTriangle,
  Tag, Car
} from 'lucide-react';
import {
  fetchAllBrandsRaw, fetchModelsForBrand,
  createBrand, updateBrand, deleteBrand, reorderBrands,
  createModel, updateModel, deleteModel, reorderModels,
  type MasterBrand, type MasterModel,
} from '@/lib/brands-data';
import { mergeAndDeleteModelAction } from '@/lib/model-actions';
import { useBrands } from '@/contexts/BrandsContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoGenCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 10);
}

const BRAND_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#1E40AF', '#6B7280', '#78716C',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrandSettingsPage() {
  const { refreshBrands } = useBrands();

  const [brands, setBrands] = useState<MasterBrand[]>([]);
  const [modelsByBrand, setModelsByBrand] = useState<Record<string, MasterModel[]>>({});
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [editingBrandName, setEditingBrandName] = useState('');
  const [editingBrandCode, setEditingBrandCode] = useState('');
  const [editingBrandColor, setEditingBrandColor] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCode, setNewBrandCode] = useState('');
  const [newBrandColor, setNewBrandColor] = useState(BRAND_COLORS[0]);

  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [editingModelName, setEditingModelName] = useState('');
  const [editingModelCode, setEditingModelCode] = useState('');
  const [addingModelForBrand, setAddingModelForBrand] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelCode, setNewModelCode] = useState('');
  const [newModelAggregate, setNewModelAggregate] = useState(false);
  const [newModelAggregateGroup, setNewModelAggregateGroup] = useState<string | null>(null);

  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modelToDelete, setModelToDelete] = useState<MasterModel | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | 'DELETE_ALL'>('DELETE_ALL');

  const [draggedModelId, setDraggedModelId] = useState<number | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<number | null>(null);
  const [draggedBrandId, setDraggedBrandId] = useState<number | null>(null);
  const [dragOverBrandId, setDragOverBrandId] = useState<number | null>(null);

  const showAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    const rawBrands = await fetchAllBrandsRaw();
    setBrands(rawBrands);

    // Load models for all brands in parallel
    const modelMap: Record<string, MasterModel[]> = {};
    await Promise.all(
      rawBrands.map(async (b) => {
        modelMap[b.name] = await fetchModelsForBrand(b.name);
      })
    );
    setModelsByBrand(modelMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Brand handlers ──────────────────────────────────────────────────────────

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;
    setSaving(true);
    const maxOrder = brands.length > 0 ? Math.max(...brands.map(b => b.sort_order)) : 0;
    const result = await createBrand({
      name: newBrandName.trim(),
      code: newBrandCode.trim() || autoGenCode(newBrandName.trim()),
      color: newBrandColor,
      sort_order: maxOrder + 1,
    });
    if (result) {
      showAlert('success', `Đã thêm thương hiệu "${result.name}"`);
      setAddingBrand(false);
      setNewBrandName('');
      setNewBrandCode('');
      setNewBrandColor(BRAND_COLORS[0]);
      await loadAll();
      refreshBrands();
    } else {
      showAlert('error', 'Lỗi khi thêm thương hiệu. Có thể tên đã tồn tại.');
    }
    setSaving(false);
  };

  const handleSaveBrand = async (id: number) => {
    if (!editingBrandName.trim()) return;
    setSaving(true);
    const ok = await updateBrand(id, { name: editingBrandName.trim(), code: editingBrandCode.trim() || autoGenCode(editingBrandName.trim()), color: editingBrandColor });
    if (ok) {
      showAlert('success', 'Đã cập nhật thương hiệu');
      setEditingBrandId(null);
      await loadAll();
      refreshBrands();
    } else {
      showAlert('error', 'Lỗi khi cập nhật thương hiệu');
    }
    setSaving(false);
  };

  const handleToggleBrandActive = async (brand: MasterBrand) => {
    setSaving(true);
    const ok = await updateBrand(brand.id, { is_active: !brand.is_active });
    if (ok) {
      showAlert('success', brand.is_active ? `Đã ẩn "${brand.name}"` : `Đã kích hoạt "${brand.name}"`);
      await loadAll();
      refreshBrands();
    }
    setSaving(false);
  };

  // ─── Model handlers ──────────────────────────────────────────────────────────

  const handleAddModel = async (brandName: string) => {
    if (!newModelName.trim()) return;
    setSaving(true);
    const existingModels = modelsByBrand[brandName] || [];
    const maxOrder = existingModels.length > 0 ? Math.max(...existingModels.map(m => m.sort_order)) : 0;
    const result = await createModel({
      brand_name: brandName,
      name: newModelName.trim(),
      code: newModelCode.trim() || autoGenCode(newModelName.trim()),
      sort_order: maxOrder + 1,
      is_aggregate: newModelAggregate,
      aggregate_group: newModelAggregateGroup,
    });
    if (result) {
      showAlert('success', `Đã thêm dòng xe "${result.name}" vào ${brandName}`);
      setAddingModelForBrand(null);
      setNewModelName('');
      setNewModelCode('');
      setNewModelAggregate(false);
      setNewModelAggregateGroup(null);
      await loadAll();
      refreshBrands();
    } else {
      showAlert('error', 'Lỗi khi thêm dòng xe. Có thể tên đã tồn tại trong thương hiệu này.');
    }
    setSaving(false);
  };

  const handleSaveModel = async (id: number) => {
    if (!editingModelName.trim()) return;
    setSaving(true);
    const ok = await updateModel(id, { name: editingModelName.trim(), code: editingModelCode.trim() || autoGenCode(editingModelName.trim()) });
    if (ok) {
      showAlert('success', 'Đã cập nhật dòng xe');
      setEditingModelId(null);
      await loadAll();
      refreshBrands();
    } else {
      showAlert('error', 'Lỗi khi cập nhật dòng xe');
    }
    setSaving(false);
  };

  const handleToggleModelActive = async (model: MasterModel) => {
    if (model.is_active) {
      const confirmHide = window.confirm(
        `CẢNH BÁO: Bạn chuẩn bị ẩn dòng xe "${model.name}".\n\n- Dữ liệu lịch sử đã nhập trước đây vẫn sẽ được giữ lại trong cơ sở dữ liệu.\n- Tuy nhiên, dòng xe này sẽ DỪNG hoàn toàn việc được cộng dồn vào Tổng Tải / Tổng Bus hoặc thẻ hiển thị ở các tháng (nếu đang bật chế độ không hiển thị mục ẩn).\n- Các kết nối trước đây liên quan đến dòng xe này trên màn hình Planning có thể không còn khớp.\n\nBạn có chắc chắn muốn bỏ nó ra khỏi báo cáo hiện tại không?`
      );
      if (!confirmHide) return;
    }

    setSaving(true);
    const ok = await updateModel(model.id, { is_active: !model.is_active });
    if (ok) {
      showAlert('success', model.is_active ? `Đã ẩn "${model.name}"` : `Đã kích hoạt "${model.name}"`);
      await loadAll();
      refreshBrands();
    }
    setSaving(false);
  };

  const handleDeleteModel = async (model: MasterModel) => {
    setModelToDelete(model);
    setMergeTargetId('DELETE_ALL');
  };

  const executeDeleteAndMerge = async () => {
    if (!modelToDelete) return;

    setSaving(true);
    if (mergeTargetId === 'DELETE_ALL') {
      const ok = await deleteModel(modelToDelete.id);
      if (ok) {
        showAlert('success', `Đã xóa vĩnh viễn "${modelToDelete.name}"`);
      } else {
        showAlert('error', `Không thể xóa (có thể đang vướng dữ liệu liên kết)`);
      }
    } else {
      const targetModel = modelsByBrand[modelToDelete.brand_name]?.find(m => m.id === mergeTargetId);
      if (!targetModel) {
        showAlert('error', 'Không tìm thấy dòng xe đích');
        setSaving(false); return;
      }
      showAlert('success', `Đang gộp "${modelToDelete.name}" vào "${targetModel.name}"...`);
      // We will implement mergeAndDeleteModel in lib/brands-data.ts
      // Note: we'll call an API or just pass it to lib
      try {
        const { success, error } = await mergeAndDeleteModelAction(
          modelToDelete.id,
          targetModel.id,
          modelToDelete.brand_name,
          modelToDelete.name,
          targetModel.name
        );
        
        if (success) {
          showAlert('success', `Đã gom dữ liệu và xóa "${modelToDelete.name}" thành công`);
        } else {
          showAlert('error', `Lỗi khi chuyển dữ liệu: ${error || 'Unknown error'}`);
        }
      } catch (e) {
        showAlert('error', 'Lỗi hệ thống khi gộp dữ liệu');
      }
    }
    
    setModelToDelete(null);
    setMergeTargetId('DELETE_ALL');
    await loadAll();
    refreshBrands();
    setSaving(false);
  };

  const handleDropModel = async (dropTargetId: number, brandName: string) => {
    if (draggedModelId === null || draggedModelId === dropTargetId) {
      setDragOverModelId(null);
      setDraggedModelId(null);
      return;
    }
    
    // Tìm mảng của brand hiện tại
    const brandModels = [...(modelsByBrand[brandName] || [])];
    const draggedIdx = brandModels.findIndex(m => m.id === draggedModelId);
    const dropTargetIdx = brandModels.findIndex(m => m.id === dropTargetId);
    
    if (draggedIdx === -1 || dropTargetIdx === -1) {
      setDragOverModelId(null);
      setDraggedModelId(null);
      return;
    }
    
    // Swap/reorder array locally
    const [draggedItem] = brandModels.splice(draggedIdx, 1);
    brandModels.splice(dropTargetIdx, 0, draggedItem);
    
    // Gắn is_aggregate xuống dưới cùng cho đẹp - hoặc giữ nguyên ý người dùng thả
    setModelsByBrand(prev => ({ ...prev, [brandName]: brandModels }));
    
    setDragOverModelId(null);
    setDraggedModelId(null);
    setSaving(true);
    
    const orderedIds = brandModels.map(m => m.id);
    const ok = await reorderModels(brandName, orderedIds);
    if (!ok) {
       showAlert('error', 'Lỗi khi lưu thứ tự dòng xe');
       await loadAll(); // revert
    } else {
       refreshBrands();
    }
    setSaving(false);
  };
  const handleDropBrand = async (dropTargetId: number) => {
    if (draggedBrandId === null || draggedBrandId === dropTargetId) {
      setDragOverBrandId(null);
      setDraggedBrandId(null);
      return;
    }
    
    // Lấy brands hiện tại
    const newBrands = [...brands];
    const draggedIdx = newBrands.findIndex(b => b.id === draggedBrandId);
    const dropTargetIdx = newBrands.findIndex(b => b.id === dropTargetId);
    
    if (draggedIdx === -1 || dropTargetIdx === -1) {
      setDragOverBrandId(null);
      setDraggedBrandId(null);
      return;
    }
    
    // Swap/reorder array locally
    const [draggedItem] = newBrands.splice(draggedIdx, 1);
    newBrands.splice(dropTargetIdx, 0, draggedItem);
    
    setBrands(newBrands);
    setDragOverBrandId(null);
    setDraggedBrandId(null);
    setSaving(true);
    
    const orderedIds = newBrands.map(b => b.id);
    const ok = await reorderBrands(orderedIds);
    if (!ok) {
       showAlert('error', 'Lỗi khi lưu thứ tự thương hiệu');
       await loadAll(); // revert
    } else {
       refreshBrands();
    }
    setSaving(false);
  };
  // ─── Render ───────────────────────────────────────────────────────────────────

  const activeCount = brands.filter(b => b.is_active).length;
  const totalModelCount = Object.values(modelsByBrand).flat().filter(m => m.is_active && !m.is_aggregate).length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Thay đổi ở đây sẽ tự động cập nhật bảng Lập kế hoạch, Quản trị sự kiện và toàn bộ hệ thống.
            <strong style={{ color: '#ef4444', marginLeft: 4 }}>Ẩn thương hiệu/dòng xe thay vì xóa để giữ lại dữ liệu lịch sử.</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-brand)', display: 'inline-block' }} />
              {activeCount} thương hiệu
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Car size={12} />
              {totalModelCount} dòng xe
            </span>
          </div>
          <button
            onClick={() => loadAll()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, color: 'var(--color-text)', cursor: 'pointer' }}
          >
            <RefreshCw size={13} />
            Làm mới
          </button>
          <button
            onClick={() => { setAddingBrand(true); setNewBrandName(''); setNewBrandColor(BRAND_COLORS[0]); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--color-brand)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
          >
            <Plus size={13} />
            Thêm thương hiệu
          </button>
        </div>
      </div>

      {/* Alert */}
      {alertMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: alertMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: alertMsg.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${alertMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          {alertMsg.type === 'error' && <AlertTriangle size={14} />}
          {alertMsg.text}
        </div>
      )}

      {/* Add Brand Form */}
      {addingBrand && (
        <div style={{ background: '#fafafa', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>Tên thương hiệu mới:</span>
          <input
            autoFocus
            type="text"
            className="form-input"
            value={newBrandName}
            onChange={e => { setNewBrandName(e.target.value); setNewBrandCode(autoGenCode(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddBrand(); if (e.key === 'Escape') setAddingBrand(false); }}
            style={{ width: 220, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Mã:</span>
          <input
            type="text"
            className="form-input"
            value={newBrandCode}
            onChange={e => setNewBrandCode(e.target.value.toUpperCase().slice(0, 10))}
            onKeyDown={e => { if (e.key === 'Enter') handleAddBrand(); if (e.key === 'Escape') setAddingBrand(false); }}
            style={{ width: 100, fontSize: 13, fontFamily: 'monospace' }}
            placeholder="VD: KIA"
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Màu:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {BRAND_COLORS.map(c => (
              <button key={c} onClick={() => setNewBrandColor(c)} style={{ width: 20, height: 20, background: c, borderRadius: 4, border: newBrandColor === c ? '2px solid #1e293b' : '1px solid var(--color-border)', opacity: newBrandColor === c ? 1 : 0.7, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <button disabled={saving || !newBrandName.trim()} onClick={handleAddBrand} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--color-brand)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Check size={13} /> Lưu
          </button>
          <button onClick={() => setAddingBrand(false)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: 12, cursor: 'pointer' }}>
            <X size={13} /> Hủy
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px auto', display: 'block' }} />
          Đang tải dữ liệu...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {brands.map((brand) => {
            const isExpanded = expandedBrands.has(brand.name);
            const models = modelsByBrand[brand.name] || [];
            const activeModels = models.filter(m => m.is_active);
            const isEditingBrand = editingBrandId === brand.id;

            return (
              <div 
                key={brand.id} 
                draggable={!isEditingBrand}
                onDragStart={(e) => {
                  setDraggedBrandId(brand.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(brand.id));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverBrandId(brand.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Ngăn sự kiện nếu có nest
                  handleDropBrand(brand.id);
                }}
                onDragEnd={() => {
                  setDragOverBrandId(null);
                  setDraggedBrandId(null);
                }}
                style={{ 
                  border: dragOverBrandId === brand.id ? '2px solid var(--color-brand)' : '1px solid var(--color-border)', 
                  borderRadius: 8, 
                  overflow: 'hidden', 
                  opacity: brand.is_active ? (draggedBrandId === brand.id ? 0.3 : 1) : 0.55 
                }}>
                {/* Brand Row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: brand.is_active ? '#fff' : '#f8fafc', gap: 10, cursor: isEditingBrand ? 'default' : 'grab' }} onClick={() => {
                  if (isEditingBrand) return;
                  setExpandedBrands(prev => {
                    const s = new Set(prev);
                    s.has(brand.name) ? s.delete(brand.name) : s.add(brand.name);
                    return s;
                  });
                }}>
                  <GripVertical size={14} style={{ color: '#cbd5e1', flexShrink: 0, cursor: 'grab' }} />

                  {/* Brand color dot */}
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: brand.color ?? '#94a3b8', flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />

                  {isEditingBrand ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      <input autoFocus type="text" className="form-input" value={editingBrandName} onChange={e => { setEditingBrandName(e.target.value); if (!editingBrandCode || editingBrandCode === autoGenCode(brand.name)) setEditingBrandCode(autoGenCode(e.target.value)); }} onKeyDown={e => { if (e.key === 'Enter') handleSaveBrand(brand.id); if (e.key === 'Escape') setEditingBrandId(null); }} style={{ width: 180, fontSize: 13 }} placeholder="Tên thương hiệu" />
                      <input type="text" className="form-input" value={editingBrandCode} onChange={e => setEditingBrandCode(e.target.value.toUpperCase().slice(0, 10))} onKeyDown={e => { if (e.key === 'Enter') handleSaveBrand(brand.id); if (e.key === 'Escape') setEditingBrandId(null); }} style={{ width: 90, fontSize: 13, fontFamily: 'monospace' }} placeholder="Mã" />
                      <div style={{ display: 'flex', gap: 4 }}>
                        {BRAND_COLORS.map(c => (
                          <button key={c} onClick={() => setEditingBrandColor(c)} style={{ width: 18, height: 18, background: c, borderRadius: 3, border: editingBrandColor === c ? '2px solid #1e293b' : '1px solid var(--color-border)', opacity: editingBrandColor === c ? 1 : 0.7, cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                      <button disabled={saving} onClick={() => handleSaveBrand(brand.id)} style={{ padding: '4px 10px', background: 'var(--color-brand)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />Lưu</button>
                      <button onClick={() => setEditingBrandId(null)} style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 5, color: 'var(--color-text)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} /></button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{brand.name}</span>
                      {brand.code && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-muted)', background: '#f1f5f9', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>
                          {brand.code}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 8, flex: 1 }}>
                        {activeModels.filter(m => !m.is_aggregate).length} dòng xe
                        {!brand.is_active && <span style={{ marginLeft: 6, color: '#ef4444', fontWeight: 600 }}>[Đã Ẩn]</span>}
                      </span>
                    </>
                  )}

                  {!isEditingBrand && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingBrandId(brand.id); setEditingBrandName(brand.name); setEditingBrandCode(brand.code ?? autoGenCode(brand.name)); setEditingBrandColor(brand.color ?? BRAND_COLORS[0]); }} style={{ padding: '5px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 5, cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><Pencil size={12} />Sửa</button>
                      <button onClick={() => handleToggleBrandActive(brand)} style={{ padding: '5px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 5, cursor: 'pointer', color: brand.is_active ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 11, fontWeight: 600 }}>
                        {brand.is_active ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  )}

                  {!isEditingBrand && (
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  )}
                </div>

                {/* Models list */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--color-border)', background: '#fff' }}>
                    {models.map((model) => {
                      const isEditingModel = editingModelId === model.id;
                      return (
                        <div 
                          key={model.id} 
                          draggable={!isEditingModel}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedModelId(model.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(model.id));
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverModelId(model.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDropModel(model.id, brand.name);
                          }}
                          onDragEnd={() => {
                            setDragOverModelId(null);
                            setDraggedModelId(null);
                          }}
                          style={{ 
                            display: 'flex', alignItems: 'center', padding: '7px 14px 7px 38px', gap: 8, 
                            borderBottom: dragOverModelId === model.id ? '2px solid var(--color-brand)' : '1px solid #f1f5f9', 
                            opacity: model.is_active ? (draggedModelId === model.id ? 0.3 : 1) : 0.5, 
                            background: model.is_aggregate ? '#f8fafc' : '#fff',
                            cursor: isEditingModel ? 'default' : 'grab'
                          }}>
                          <GripVertical size={12} style={{ color: '#cbd5e1', flexShrink: 0, cursor: 'grab' }} />


                          {isEditingModel ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }} onClick={e => e.stopPropagation()}>
                              <input autoFocus type="text" className="form-input" value={editingModelName} onChange={e => { setEditingModelName(e.target.value); if (!editingModelCode || editingModelCode === autoGenCode(model.name)) setEditingModelCode(autoGenCode(e.target.value)); }} onKeyDown={e => { if (e.key === 'Enter') handleSaveModel(model.id); if (e.key === 'Escape') setEditingModelId(null); }} style={{ width: 170, fontSize: 12 }} placeholder="Tên dòng xe" />
                              <input type="text" className="form-input" value={editingModelCode} onChange={e => setEditingModelCode(e.target.value.toUpperCase().slice(0, 10))} onKeyDown={e => { if (e.key === 'Enter') handleSaveModel(model.id); if (e.key === 'Escape') setEditingModelId(null); }} style={{ width: 85, fontSize: 12, fontFamily: 'monospace' }} placeholder="Mã" />
                              <button disabled={saving} onClick={() => handleSaveModel(model.id)} style={{ padding: '3px 8px', background: 'var(--color-brand)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={11} />Lưu</button>
                              <button onClick={() => setEditingModelId(null)} style={{ padding: '3px 7px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={11} /></button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, fontStyle: model.is_aggregate ? 'italic' : 'normal', color: model.is_aggregate ? '#94a3b8' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              {model.name}
                              {model.code && (
                                <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-muted)', background: '#f1f5f9', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 4px', letterSpacing: '0.05em' }}>
                                  {model.code}
                                </span>
                              )}
                              {model.is_aggregate && <span style={{ fontSize: 10, color: '#94a3b8' }}>(tổng hợp)</span>}
                              {!model.is_active && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>[Đã Ẩn]</span>}
                            </span>
                          )}

                          {!isEditingModel && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => { setEditingModelId(model.id); setEditingModelName(model.name); setEditingModelCode(model.code ?? autoGenCode(model.name)); }} style={{ padding: '3px 7px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }} title="Sửa tên"><Pencil size={11} /></button>
                              <button onClick={() => handleToggleModelActive(model)} style={{ padding: '3px 7px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: model.is_active ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 11, fontWeight: 600 }}>
                                {model.is_active ? 'Ẩn' : 'Hiện'}
                              </button>
                              <button onClick={() => handleDeleteModel(model)} style={{ padding: '3px 7px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }} title="Xóa vĩnh viễn">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add model inline */}
                    {addingModelForBrand === brand.name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 38px', background: '#fafafa', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                        <Plus size={12} style={{ color: 'var(--color-brand)' }} />
                        <input
                          autoFocus
                          type="text"
                          className="form-input"
                          value={newModelName}
                          onChange={e => { setNewModelName(e.target.value); setNewModelCode(autoGenCode(e.target.value)); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddModel(brand.name); if (e.key === 'Escape') setAddingModelForBrand(null); }}
                          style={{ width: 200, fontSize: 12 }}
                          placeholder="Tên dòng xe"
                        />
                        <input
                          type="text"
                          className="form-input"
                          value={newModelCode}
                          onChange={e => setNewModelCode(e.target.value.toUpperCase().slice(0, 10))}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddModel(brand.name); if (e.key === 'Escape') setAddingModelForBrand(null); }}
                          style={{ width: 85, fontSize: 12, fontFamily: 'monospace' }}
                          placeholder="Mã"
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={newModelAggregate} onChange={e => setNewModelAggregate(e.target.checked)} />
                          Hàng tổng hợp
                        </label>
                        {brand.name === 'TẢI BUS' && (
                          <select
                            value={newModelAggregateGroup || ''}
                            onChange={(e) => setNewModelAggregateGroup(e.target.value || null)}
                            className="form-input"
                            style={{ width: 140, padding: '4px 8px', fontSize: 11 }}
                          >
                            <option value="">Thuộc Tải hay Bus?</option>
                            <option value="TONG_TAI">Tính vào Tổng Tải</option>
                            <option value="TONG_BUS">Tính vào Tổng Bus</option>
                          </select>
                        )}
                        <button disabled={saving || !newModelName.trim()} onClick={() => handleAddModel(brand.name)} style={{ padding: '4px 10px', background: 'var(--color-brand)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={12} />Thêm</button>
                        <button onClick={() => { setAddingModelForBrand(null); setNewModelName(''); setNewModelCode(''); setNewModelAggregate(false); setNewModelAggregateGroup(null); }} style={{ padding: '4px 8px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 5, color: 'var(--color-text)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><X size={12} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingModelForBrand(brand.name); setNewModelName(''); setNewModelCode(''); setNewModelAggregate(false); setNewModelAggregateGroup(null); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 8px 38px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-brand)', fontSize: 12, fontWeight: 500, textAlign: 'left' }}
                      >
                        <Plus size={13} />
                        Thêm dòng xe mới vào {brand.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info panel */}
      <div style={{ marginTop: 24, padding: '12px 16px', background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--color-text)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={14} style={{ color: 'var(--color-brand)' }} /> Cách thức hoạt động
        </strong>
        <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
          <li>Nhấn tên thương hiệu để <strong>mở rộng / thu gọn</strong> danh sách dòng xe</li>
          <li>Dùng <strong>Ẩn</strong> thay vì xóa để bảo toàn dữ liệu lịch sử</li>
          <li><strong>Hàng tổng hợp</strong>: checkbox dùng cho các row như "Tổng Tải", "Tổng Bus" — không phân bổ ngân sách riêng</li>
          <li>Thay đổi sẽ <strong>tức thì cập nhật</strong> Bảng Lập kế hoạch sau khi Ctrl+Shift+R</li>
        </ul>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {modelToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 450, maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={18} />
              Xác nhận xóa dòng xe
            </h3>
            
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
              Bạn đang thực hiện xóa dòng xe <strong>"{modelToDelete.name}"</strong> thuộc thương hiệu <strong>{modelToDelete.brand_name}</strong>.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 6, padding: '12px 14px', marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Tùy chọn xử lý dữ liệu hiện thao:</label>
              <select 
                className="form-input" 
                value={mergeTargetId} 
                onChange={(e) => setMergeTargetId(e.target.value === 'DELETE_ALL' ? 'DELETE_ALL' : Number(e.target.value))}
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', height: 'auto' }}
              >
                <option value="DELETE_ALL">Xóa vĩnh viễn (Cảnh báo: Mất toàn bộ dữ liệu lịch sử)</option>
                <optgroup label="Hoặc gộp dữ liệu sang:">
                  {modelsByBrand[modelToDelete.brand_name]?.filter(m => m.id !== modelToDelete.id).map(m => (
                    <option key={m.id} value={m.id}>Chuyển dữ liệu sang: {m.name}</option>
                  ))}
                </optgroup>
              </select>
              
              {mergeTargetId === 'DELETE_ALL' ? (
                <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#ef4444' }}>Cảnh báo: Hành động này KHÔNG THỂ hoàn tác! Dữ liệu ngân sách thuộc dòng xe này sẽ bị mất khỏi báo cáo.</p>
              ) : (
                <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#059669' }}>Dữ liệu của "{modelToDelete.name}" sẽ được cộng dồn vào dòng xe bạn chọn trước khi xóa.</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setModelToDelete(null)}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeDeleteAndMerge}
                disabled={saving}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? 'Đang xử lý...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
