'use client';

import React, { useMemo } from 'react';

// ─── Bar Chart — NS kế hoạch vs thực hiện theo tháng ─────────────────────────

interface BarChartProps {
  data: { month: number; plan: number; actual: number }[];
  highlightMonth?: number;
  height?: number;
}

export function BudgetBarChart({ data, highlightMonth, height = 160 }: BarChartProps) {
  const maxVal = useMemo(() => Math.max(...data.map(d => Math.max(d.plan, d.actual, 1))), [data]);

  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
        Chưa có dữ liệu
      </div>
    );
  }

  const paddingX = 4;
  const paddingTop = 16;
  const paddingBottom = 28;
  const chartWidth = 100; // viewBox percent-based
  const chartHeight = height - paddingTop - paddingBottom;
  const barGroupWidth = chartWidth / data.length;
  const barW = barGroupWidth * 0.3;
  const gap = barGroupWidth * 0.05;

  const formatM = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}B`;
    if (v >= 1) return `${v.toFixed(0)}M`;
    return '0';
  };

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => {
        const y = paddingTop + chartHeight * (1 - pct);
        return (
          <line
            key={pct}
            x1={paddingX} x2={chartWidth - paddingX} y1={y} y2={y}
            stroke="var(--color-border)" strokeWidth="0.3" strokeDasharray="1,1"
          />
        );
      })}

      {data.map((d, i) => {
        const isHighlight = d.month === highlightMonth;
        const x = paddingX + i * barGroupWidth;
        const cx = x + barGroupWidth / 2;

        const planH = maxVal > 0 ? (d.plan / maxVal) * chartHeight : 0;
        const actualH = maxVal > 0 ? (d.actual / maxVal) * chartHeight : 0;

        const planY = paddingTop + chartHeight - planH;
        const actualY = paddingTop + chartHeight - actualH;

        const planX = cx - barW - gap / 2;
        const actualX = cx + gap / 2;

        return (
          <g key={d.month}>
            {/* Highlight background */}
            {isHighlight && (
              <rect
                x={x + paddingX * 0.2} y={paddingTop} width={barGroupWidth - paddingX * 0.4} height={chartHeight}
                fill="var(--color-brand)" opacity="0.06" rx="1"
              />
            )}

            {/* Plan bar */}
            <rect
              x={planX} y={planY} width={barW} height={planH}
              fill={isHighlight ? 'var(--color-border)' : '#cbd5e1'}
              rx="0.5"
            />

            {/* Actual bar */}
            {d.actual > 0 && (
              <rect
                x={actualX} y={actualY} width={barW} height={actualH}
                fill={d.actual > d.plan ? 'var(--color-danger)' : isHighlight ? 'var(--color-brand)' : 'var(--color-info)'}
                rx="0.5"
                opacity={isHighlight ? 1 : 0.75}
              />
            )}

            {/* Month label */}
            <text
              x={cx} y={height - 4}
              textAnchor="middle"
              fontSize="3.2"
              fill={isHighlight ? 'var(--color-brand)' : 'var(--color-text-muted)'}
              fontWeight={isHighlight ? '700' : '400'}
            >
              T{d.month}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${paddingX}, 4)`}>
        <rect x="0" y="0" width="3" height="3" fill="#cbd5e1" rx="0.5" />
        <text x="4" y="3.2" fontSize="3" fill="var(--color-text-muted)">Kế hoạch</text>
        <rect x="18" y="0" width="3" height="3" fill="var(--color-info)" rx="0.5" />
        <text x="22" y="3.2" fontSize="3" fill="var(--color-text-muted)">Thực hiện</text>
      </g>
    </svg>
  );
}

// ─── Donut Chart — Phân bổ kênh ──────────────────────────────────────────────

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  innerRadius?: number;
}

export function DonutChart({ data, size = 120, innerRadius = 38 }: DonutChartProps) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const slices = useMemo(() => {
    if (total === 0) return [];
    let startAngle = -Math.PI / 2;
    return data.filter(d => d.value > 0).map((d) => {
      const pct = d.value / total;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const cx = size / 2;
      const cy = size / 2;
      const outerR = size / 2 - 4;
      const innerR = innerRadius;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(endAngle);
      const iy1 = cy + innerR * Math.sin(endAngle);
      const ix2 = cx + innerR * Math.cos(startAngle);
      const iy2 = cy + innerR * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        'Z',
      ].join(' ');

      const midAngle = startAngle + angle / 2;
      const labelR = outerR + 8;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle);

      startAngle = endAngle;
      return { ...d, path, pct, labelX, labelY, midAngle };
    });
  }, [data, total, size, innerRadius]);

  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s) => (
        <path key={s.name} d={s.path} fill={s.color} stroke="var(--color-bg)" strokeWidth="1.5" />
      ))}
      {/* Center text */}
      <text x={size / 2} y={size / 2 - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-text)">
        {slices.length}
      </text>
      <text x={size / 2} y={size / 2 + 9} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
        kênh
      </text>
    </svg>
  );
}

// ─── Sparkline — mini trend line ──────────────────────────────────────────────

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, color = 'var(--color-brand)', width = 60, height = 24 }: SparklineProps) {
  const points = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    return values.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
  }, [values, width, height]);

  if (values.length < 2) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point dot */}
      {(() => {
        const last = points.split(' ').pop()?.split(',');
        if (!last) return null;
        return <circle cx={last[0]} cy={last[1]} r="2" fill={color} />;
      })()}
    </svg>
  );
}
