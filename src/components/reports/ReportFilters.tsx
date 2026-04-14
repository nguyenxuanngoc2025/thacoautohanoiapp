'use client';
import { MONTHS } from '@/lib/constants';

export interface ReportFilterState {
  year: number;
  viewMode: 'month' | 'quarter' | 'year';
  month: number;
  brand: string;
  showroom: string;
  channel: string;
}

const QUARTERS = [1, 2, 3, 4];
const CHANNELS = ['', 'Facebook', 'Google', 'Khác', 'CSKH', 'Nhận diện', 'Sự kiện'];

export function ReportFilters({
  filters,
  showrooms,
  brands,
  onChange,
  visibleFields = ['viewMode', 'period', 'brand', 'showroom', 'channel'],
}: {
  filters: ReportFilterState;
  showrooms: string[];
  brands: string[];
  onChange: (f: Partial<ReportFilterState>) => void;
  visibleFields?: string[];
}) {
  const SELECT_STYLE: React.CSSProperties = {
    height: 28, padding: '0 6px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-erp)',
    fontSize: 'var(--fs-body)',
    background: '#fff', color: 'var(--color-text)',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {visibleFields.includes('viewMode') && (
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {(['month', 'quarter', 'year'] as const).map((m) => (
            <button key={m} onClick={() => onChange({ viewMode: m })}
              style={{
                padding: '4px 10px', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-body)',
                background: filters.viewMode === m ? 'var(--color-primary)' : '#fff',
                color: filters.viewMode === m ? '#fff' : 'var(--color-text-muted)',
                fontWeight: filters.viewMode === m ? 700 : 400,
              }}>
              {m === 'month' ? 'Tháng' : m === 'quarter' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>
      )}

      {visibleFields.includes('period') && filters.viewMode === 'month' && (
        <select value={filters.month} onChange={(e) => onChange({ month: +e.target.value })} style={SELECT_STYLE}>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      )}
      {visibleFields.includes('period') && filters.viewMode === 'quarter' && (
        <select value={Math.ceil(filters.month / 3)} onChange={(e) => onChange({ month: (+e.target.value - 1) * 3 + 1 })} style={SELECT_STYLE}>
          {QUARTERS.map((q) => <option key={q} value={q}>Quý {q}</option>)}
        </select>
      )}

      <select value={filters.year} onChange={(e) => onChange({ year: +e.target.value })} style={SELECT_STYLE}>
        {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      {visibleFields.includes('brand') && brands.length > 0 && (
        <select value={filters.brand} onChange={(e) => onChange({ brand: e.target.value })} style={SELECT_STYLE}>
          <option value="">— Tất cả thương hiệu —</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      )}

      {visibleFields.includes('showroom') && showrooms.length > 0 && (
        <select value={filters.showroom} onChange={(e) => onChange({ showroom: e.target.value })} style={SELECT_STYLE}>
          <option value="">— Tất cả showroom —</option>
          {showrooms.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {visibleFields.includes('channel') && (
        <select value={filters.channel} onChange={(e) => onChange({ channel: e.target.value })} style={SELECT_STYLE}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c || '— Tất cả kênh —'}</option>)}
        </select>
      )}
    </div>
  );
}
