'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  width = 120,
  isMulti = false,
  placeholder = '— Tất cả —'
}: {
  label?: string,
  value: string | string[],
  options: { value: string, label: string }[],
  onChange: (val: any) => void,
  width?: number | string,
  isMulti?: boolean,
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localVal, setLocalVal] = useState<string | string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setLocalVal(value);
  }, [isOpen, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayLabel = () => {
    if (isMulti) {
      const arr = value as string[];
      if (!arr || arr.length === 0) return placeholder;
      return `${arr.length} đã chọn`;
    }
    if (value === 'all' || !value) return placeholder;
    const found = options.find(o => o.value === value);
    return found ? found.label : (value as string);
  };

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', flexShrink: 0 }}>
      {label && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="form-select"
        style={{ width, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: 28, cursor: 'pointer', border: isOpen ? '1px solid var(--color-brand)' : undefined }}
      >
        <span style={{ fontSize: 'var(--fs-table)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel()}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>
      
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: label ? 50 : 0, marginTop: 4, width: typeof width === 'number' ? Math.max(width, 180) : '100%', minWidth: 180, background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-dark)', borderRadius: 'var(--border-radius-erp)', boxShadow: 'var(--shadow-dropdown)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {isMulti ? (
              <>
                <div
                  style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-brand)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--color-surface-elevated)', zIndex: 2 }}
                  onClick={() => setLocalVal([])}
                >
                  Bỏ chọn tất cả
                </div>
                {options.map(o => {
                  const arr = (localVal ?? value) as string[];
                  const isChecked = arr.includes(o.value);
                  return (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 'var(--fs-table)', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text)', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setLocalVal(prev => [...((prev as string[]) || []), o.value]);
                          else setLocalVal(prev => ((prev as string[]) || []).filter(x => x !== o.value));
                        }}
                        style={{ margin: 0, cursor: 'pointer' }}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </>
            ) : (
              options.map(o => (
                <div
                  key={o.value}
                  style={{ padding: '6px 8px', cursor: 'pointer', fontSize: 'var(--fs-table)', borderBottom: '1px solid var(--color-border-light)', background: value === o.value ? 'var(--color-primary-light)' : 'transparent', color: value === o.value ? 'var(--color-brand)' : 'var(--color-text)', fontWeight: value === o.value ? 600 : 400 }}
                  onClick={() => {
                    onChange(o.value);
                    setIsOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
          {isMulti && (
            <div style={{ padding: 8, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }}>
              <button
                onClick={() => {
                  if (localVal !== null) onChange(localVal);
                  setIsOpen(false);
                }}
                className="button-erp-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
