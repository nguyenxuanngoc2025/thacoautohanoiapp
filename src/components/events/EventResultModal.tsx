// app/src/components/events/EventResultModal.tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EventItem } from '@/lib/events-data';

interface Props {
  event: EventItem;
  onClose: () => void;
  onSaved: (updated: EventItem) => void;
}

export default function EventResultModal({ event, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    budgetSpent:    event.budgetSpent    ?? 0,
    leadsActual:    event.leadsActual    ?? 0,
    gdtdActual:     event.gdtdActual     ?? 0,
    dealsActual:    event.dealsActual    ?? 0,
    testDrivesActual: event.testDrivesActual ?? 0,
    endDate:        event.endDate        ?? event.date,
    notes:          event.notes          ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleChange = (field: keyof typeof form, val: string) => {
    setForm(prev => ({
      ...prev,
      [field]: ['budgetSpent','leadsActual','gdtdActual','dealsActual','testDrivesActual'].includes(field)
        ? Number(val) || 0
        : val,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload_actual = {
      budget_spent:       form.budgetSpent,
      leads_actual:       Math.round(form.leadsActual),
      gdtd_actual:        Math.round(form.gdtdActual),
      deals_actual:       Math.round(form.dealsActual),
      test_drives_actual: Math.round(form.testDrivesActual),
    };

    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from('thaco_events')
      .update({
        // JSONB aggregated field
        payload_actual,
        settled_at: new Date().toISOString(),
        // Individual columns (backward compat — events-data.ts reads these)
        budget_spent: form.budgetSpent,
        leads_actual: Math.round(form.leadsActual),
        gdtd_actual: Math.round(form.gdtdActual),
        deals_actual: Math.round(form.dealsActual),
        test_drives_actual: Math.round(form.testDrivesActual),
        end_date: form.endDate || null,
        notes: form.notes || null,
      })
      .eq('id', event.id);

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }

    onSaved({
      ...event,
      budgetSpent:      form.budgetSpent,
      leadsActual:      Math.round(form.leadsActual),
      gdtdActual:       Math.round(form.gdtdActual),
      dealsActual:      Math.round(form.dealsActual),
      testDrivesActual: Math.round(form.testDrivesActual),
      endDate:          form.endDate,
      notes:            form.notes,
    });
    onClose();
  };

  const fieldLabel: Record<string, string> = {
    budgetSpent: 'Chi phí thực tế (triệu VND)',
    leadsActual: 'Lead thực thu',
    gdtdActual: 'GDTD thực tế',
    dealsActual: 'Hợp đồng thực tế',
    testDrivesActual: 'Lái thử thực tế',
    endDate: 'Ngày kết thúc thực tế (DD/MM/YYYY)',
    notes: 'Ghi chú quyết toán',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-bg, #fff)', borderRadius: 12, padding: 28, width: 480,
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        border: '1px solid var(--color-border, #e2e8f0)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
          Nhập kết quả thực tế
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--color-text-muted, #666)' }}>
          {event.name} — {event.showroom}
        </p>

        {Object.entries(form).map(([field, val]) => (
          <div key={field} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-text-secondary, #444)' }}>
              {fieldLabel[field] || field}
            </label>
            {field === 'notes' ? (
              <textarea
                value={val as string}
                onChange={e => handleChange(field as keyof typeof form, e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border, #d1d5db)', fontSize: 13,
                  boxSizing: 'border-box', resize: 'vertical',
                  background: 'var(--color-bg, #fff)', color: 'var(--color-text, #1e293b)',
                }}
              />
            ) : (
              <input
                type={field === 'endDate' ? 'text' : 'number'}
                value={val}
                onChange={e => handleChange(field as keyof typeof form, e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border, #d1d5db)', fontSize: 13,
                  boxSizing: 'border-box',
                  background: 'var(--color-bg, #fff)', color: 'var(--color-text, #1e293b)',
                }}
              />
            )}
          </div>
        ))}

        {/* KPI calculated preview */}
        {form.budgetSpent > 0 && form.leadsActual > 0 && (
          <div style={{
            padding: '10px 12px', background: 'var(--color-bg-hover, #f8fafc)',
            borderRadius: 8, marginBottom: 16, border: '1px solid var(--color-border, #e2e8f0)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted, #64748b)', marginBottom: 6 }}>
              KPI tính toán
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span>CPL: <strong>{(form.budgetSpent / form.leadsActual).toFixed(2)}</strong> tr</span>
              {form.gdtdActual > 0 && form.leadsActual > 0 && (
                <span>CR1: <strong>{((form.gdtdActual / form.leadsActual) * 100).toFixed(1)}%</strong></span>
              )}
              {form.dealsActual > 0 && form.gdtdActual > 0 && (
                <span>CR2: <strong>{((form.dealsActual / form.gdtdActual) * 100).toFixed(1)}%</strong></span>
              )}
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid var(--color-border, #d1d5db)',
              background: 'var(--color-bg, #fff)', cursor: 'pointer', fontSize: 13,
              color: 'var(--color-text, #1e293b)' }}
          >
            Huỷ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 6, border: 'none',
              background: saving ? '#9ca3af' : 'var(--color-brand, #1e40af)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu kết quả'}
          </button>
        </div>
      </div>
    </div>
  );
}
