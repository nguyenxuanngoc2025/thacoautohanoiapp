import React from 'react';
import { formatNumber } from '@/lib/utils';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function KPICard({ icon: Icon, label, value, unit, subValue, color, trend }: {
  icon: React.ElementType; label: string; value: string | number; unit?: string;
  subValue?: string; color: string; trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div
      className="kpi-card-event"
      style={{ borderTopColor: color }}
    >
      <div className="kpi-card-event-header">
        <div className="kpi-card-event-icon" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <div
            className="kpi-card-event-trend"
            style={{ color: trend === 'up' ? '#059669' : '#dc2626' }}
          >
            {trend === 'up' ? '▲' : '▼'} vs tháng trước
          </div>
        )}
      </div>
      <div>
        <div className="kpi-card-event-label">{label}</div>
        <div className="kpi-card-event-value">
          {typeof value === 'number' ? formatNumber(value) : value}
          {unit && <span className="kpi-card-event-unit">{unit}</span>}
        </div>
        {subValue && <div className="kpi-card-event-sub">{subValue}</div>}
      </div>
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
export function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 90, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, height: 18, background: 'var(--color-surface-hover)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', width: `${Math.max((d.value / max) * 100, 2)}%`, background: `linear-gradient(90deg, ${d.color}, ${d.color}bb)`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
              {(d.value / max) > 0.3 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{d.value}</span>}
            </div>
            {(d.value / max) <= 0.3 && <span style={{ position: 'absolute', left: `${(d.value / max) * 100 + 2}%`, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{d.value}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
export function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="chart-empty">Chưa có sự kiện</div>;
  const radius = 42; const circ = 2 * Math.PI * radius; let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        {data.map((d, i) => { const pct = d.value / total; const dash = pct * circ; const offset = -acc * circ + circ * 0.25; acc += pct; return <circle key={i} cx="60" cy="60" r={radius} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />; })}
        <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--color-text)">{total}</text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">sự kiện</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
            <span style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{d.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--color-text)', marginLeft: 4 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Sparkline ────────────────────────────────────────────────────────
export function MonthlySparkline({ data, color = '#3B82F6' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1); const h = 48; const w = 220;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - (v / max) * (h - 8) - 4 }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const id = `sg${color.replace('#', '')}`;
  return (
    <svg width={w} height={h + 4} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${pathD} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} style={{ fill: 'var(--color-surface)' }} stroke={color} strokeWidth="1.5" />)}
    </svg>
  );
}
