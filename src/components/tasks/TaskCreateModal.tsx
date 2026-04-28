'use client';

import React, { useState } from 'react';
import { createManualTask } from '@/lib/tasks-data';
import { type TaskPriority } from '@/lib/tasks-engine';

interface TaskCreateModalProps {
  isOpen: boolean;
  initialShowroom: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskCreateModal({ isOpen, initialShowroom, onClose, onSuccess }: TaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('this_week');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên công việc');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createManualTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        showroom: initialShowroom,
        dueDate: dueDate ? new Date(dueDate) : null
      });

      onSuccess();
    } catch (err: any) {
      if (err.message?.includes('relation "thaco_tasks" does not exist')) {
         setError('Chưa tạo bảng "thaco_tasks" trên Database. Vui lòng thiết lập DB trước!');
      } else {
         setError(err.message || 'Có lỗi xảy ra khi lưu việc');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 'var(--border-radius-erp)', 
        width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1f36', margin: 0 }}>Tạo việc mới</h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8792a2' }}
          >×</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4257', marginBottom: 6 }}>Tên công việc</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kiểm tra vật tư in ấn sự kiện Mai Lĩnh..."
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', 
                borderRadius: 6, fontSize: 14, outline: 'none'
              }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4257', marginBottom: 6 }}>Mô tả chi tiết</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú thêm..."
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', 
                borderRadius: 6, fontSize: 14, outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4257', marginBottom: 6 }}>Mức độ / Nhóm lịch</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', 
                  borderRadius: 6, fontSize: 14, outline: 'none', backgroundColor: '#fff'
                }}
              >
                <option value="urgent">Khẩn cấp (Hôm nay)</option>
                <option value="this_week">Làm trong Tuần</option>
                <option value="this_month">Kế hoạch Tháng</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#3c4257', marginBottom: 6 }}>Hạn chót (Tùy chọn)</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', 
                  borderRadius: 6, fontSize: 14, outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px', background: '#f1f5f9', color: '#475569',
                border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px', background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
                cursor: 'pointer', opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Đang lưu...' : 'Tạo việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
