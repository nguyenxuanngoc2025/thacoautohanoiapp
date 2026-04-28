'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { EmptyDataState } from './EmptyDataState';

export function FunnelChart3D({ totalKhqt, totalGdtd, totalKhd, isFallback }: { totalKhqt: number, totalGdtd: number, totalKhd: number, isFallback?: boolean }) {
  const [funnelTooltip, setFunnelTooltip] = useState<{ visible: boolean, name: string, value: string, x: number, y: number } | null>(null);

  if (!totalKhqt && !totalGdtd && !totalKhd) {
    return <EmptyDataState />;
  }

  return (
    <div style={{ flex: 1, padding: '16px 0', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {isFallback && (
        <div style={{ position: 'absolute', top: 6, right: 10, fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-surface-hover)', borderRadius: 4, padding: '2px 6px', fontWeight: 500, zIndex: 1 }}>
          KH
        </div>
      )}
      <svg width="100%" height="100%" viewBox="0 0 460 250" style={{ overflow: 'visible', maxWidth: 480, maxHeight: 280 }}>
        <defs>
          <filter id="funnel-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.1" />
          </filter>
          <filter id="tier-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
          </filter>
          {[
            { id: 'khqt', c1: '#fcd34d', c2: '#d97706' }, // Yellow/Gold
            { id: 'gdtd', c1: '#34d399', c2: '#059669' }, // Teal/Green
            { id: 'khd', c1: '#60a5fa', c2: '#2563eb' }   // Blue
          ].map(c => (
            <linearGradient key={c.id} id={`grad-${c.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={c.c2} />
              <stop offset="35%" stopColor={c.c1} />
              <stop offset="65%" stopColor={c.c1} />
              <stop offset="100%" stopColor={c.c2} />
            </linearGradient>
          ))}
        </defs>
        
        <g filter="url(#funnel-shadow)">
          {[
            { id: 'khqt', dataKey: 'KHQT', value: totalKhqt || 0, yTop: 10, yBot: 80, wTop: 240, wBot: 180, ryTop: 20, ryBot: 15, topColor: '#fde68a', colorDark: '#d97706', labelFull: 'KHÁCH HÀNG QUAN TÂM' },
            { id: 'gdtd', dataKey: 'GDTD', value: totalGdtd || 0, yTop: 80, yBot: 160, wTop: 180, wBot: 130, ryTop: 15, ryBot: 11, topColor: '#6ee7b7', colorDark: '#059669', labelFull: 'GIAO DỊCH THEO DÕI' },
            { id: 'khd', dataKey: 'KHĐ', value: totalKhd || 0, yTop: 160, yBot: 240, wTop: 130, wBot: 80, ryTop: 11, ryBot: 7, topColor: '#93c5fd', colorDark: '#2563eb', labelFull: 'KÝ HỢP ĐỒNG' }
          ].reverse().map((t, reveresedIdx, arr) => {
            const i = arr.length - 1 - reveresedIdx;
            const originalArr = [...arr].reverse();
            const cx = 130;  // Lùi phễu sang trái
            const xTL = cx - t.wTop/2;
            const xTR = cx + t.wTop/2;
            const xBL = cx - t.wBot/2;
            const xBR = cx + t.wBot/2;
            
            const cy = t.yTop + (t.yBot - t.yTop) / 2;
            const prevVal = i > 0 ? originalArr[i - 1].value : t.value;
            const conv = prevVal > 0 ? ((t.value / prevVal) * 100).toFixed(1) : 0;
            
            return (
              <g 
                key={t.id}
                onMouseEnter={(e) => setFunnelTooltip({ visible: true, name: t.labelFull, value: `${formatNumber(Math.round(t.value))} khách`, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setFunnelTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setFunnelTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* 3D Tier Body */}
                <path
                  d={`M ${xTL} ${t.yTop} L ${xBL} ${t.yBot} A ${t.wBot/2} ${t.ryBot} 0 0 0 ${xBR} ${t.yBot} L ${xTR} ${t.yTop} A ${t.wTop/2} ${t.ryTop} 0 0 0 ${xTL} ${t.yTop} Z`}
                  fill={`url(#grad-${t.id})`}
                  filter="url(#tier-shadow)"
                />
                
                {/* Top surface */}
                <ellipse cx={cx} cy={t.yTop} rx={t.wTop/2} ry={t.ryTop} fill={t.topColor} />
                
                {/* Inner hole for top tier */}
                {t.id === 'khqt' && (
                  <ellipse cx={cx} cy={t.yTop} rx={t.wTop/2 * 0.8} ry={t.ryTop * 0.8} fill="#b45309" opacity={0.6} />
                )}

                {/* Leader Line to Info */}
                <polyline points={`${cx + (t.wTop + t.wBot)/4 + 5},${cy} 265,${cy}`} fill="none" stroke="var(--color-border)" strokeWidth={1} />
                <circle cx="265" cy={cy} r="3" fill="var(--color-primary)" />

                {/* Full Info Details */}
                <text x="278" y={cy - 12} fontSize={12} fill="var(--color-text-muted)" fontWeight="600">{t.labelFull}</text>
                <text x="278" y={cy + 8} fontSize={22} fontWeight="800" fill="var(--color-text)">
                  {formatNumber(Math.round(t.value))} <tspan fontSize={14} fontWeight="600" fill="var(--color-text-secondary)">khách</tspan>
                </text>
                
                {i > 0 && (
                  <g>
                    <rect x="278" y={cy + 16} width="160" height="24" rx="12" fill={t.topColor} opacity={0.25} />
                    <text x="290" y={cy + 32} fontSize={11.5} fontWeight="bold" fill={t.colorDark}>
                      Tỉ lệ chuyển đổi: {conv}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {funnelTooltip?.visible && (
        <div style={{
          position: 'fixed',
          left: funnelTooltip.x + 10,
          top: funnelTooltip.y + 10,
          backgroundColor: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '10px 12px',
          boxShadow: 'var(--shadow-dropdown)',
          fontSize: 11,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{funnelTooltip.name}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{funnelTooltip.value}</span>
        </div>
      )}
    </div>
  );
}
