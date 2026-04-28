'use client';

import { formatNumber } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { AreaChart, Area, YAxis } from 'recharts';

export function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const data = values.map((v, i) => ({ value: v, index: i }));
  const gradId = color.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div style={{ width: 72, height: 28, display: 'flex', alignItems: 'flex-end', marginLeft: -4 }}>
      <AreaChart width={72} height={28} data={data} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
            <stop offset="100%" stopColor={color} stopOpacity={0.01}/>
          </linearGradient>
        </defs>
        <YAxis domain={[0, 'dataMax + (dataMax * 0.1)']} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#grad-${gradId})`}
          isAnimationActive={false}
          dot={(props: any) => {
            if (props.index === data.length - 1) {
              return (
                <circle 
                  cx={props.cx} 
                  cy={props.cy} 
                  r={3.5} 
                  fill={color} 
                  stroke="#ffffff" 
                  strokeWidth={2} 
                  key="last-dot" 
                />
              );
            }
            return <span key={props.index} style={{ display: 'none' }} />;
          }}
          activeDot={false}
        />
      </AreaChart>
    </div>
  );
}

export function KpiCard({ label, value, plan, spark, sparkColor, higherIsBad, deltaColor, deltaBg }: {
  label: string; value: number; plan: number;
  spark: number[]; sparkColor: string; higherIsBad: boolean;
  deltaColor: (v: number, p: number, bad: boolean) => string;
  deltaBg: (v: number, p: number, bad: boolean) => string;
}) {
  const delta = plan > 0 ? ((value - plan) / plan * 100) : 0;
  const isUp = delta >= 0;
  const clr = deltaColor(value, plan, higherIsBad);
  const bg  = deltaBg(value, plan, higherIsBad);
  return (
    <div className="panel" style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      {/* Label: Top Center */}
      <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.02em', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      
      {/* Center Block: Number and Delta */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value > 0 ? formatNumber(Math.round(value)) : <span style={{ color: 'var(--color-text-muted)' }}>— —</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: bg, color: clr }}>
            {isUp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            vs KH {formatNumber(Math.round(plan))}
          </span>
        </div>
      </div>

      {/* Bottom Block: Sparkline */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <SparkLine values={spark} color={sparkColor} />
      </div>
    </div>
  );
}
