'use client';
import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

const DEMO = {
  showrooms: [
    { name: 'Phạm Văn Đồng', plan: 450, actual: 320, brands: [
      { name: 'KIA', plan: 200, actual: 180 },
      { name: 'Mazda', plan: 150, actual: 90 },
      { name: 'Stellantis', plan: 100, actual: 50 },
    ]},
    { name: 'Đông Trù', plan: 380, actual: 350, brands: [
      { name: 'KIA', plan: 200, actual: 195 },
      { name: 'Mazda', plan: 180, actual: 155 },
    ]},
    { name: 'Giải Phóng', plan: 320, actual: 250, brands: [
      { name: 'KIA', plan: 170, actual: 130 },
      { name: 'Mazda', plan: 150, actual: 120 },
    ]},
    { name: 'Bạch Đằng/TKC', plan: 280, actual: 230, brands: [
      { name: 'KIA', plan: 150, actual: 130 },
      { name: 'Mazda', plan: 130, actual: 100 },
    ]},
    { name: 'BMW Long Biên', plan: 200, actual: 210, brands: [
      { name: 'BMW', plan: 170, actual: 185 },
      { name: 'MINI', plan: 30, actual: 25 },
    ]},
    { name: 'Lê Văn Lương', plan: 180, actual: 175, brands: [
      { name: 'BMW', plan: 150, actual: 150 },
      { name: 'MINI', plan: 30, actual: 25 },
    ]},
    { name: 'Đài Tư', plan: 120, actual: 95, brands: [{ name: 'Tải/Bus', plan: 120, actual: 95 }]},
    { name: 'Nguyễn Văn Cừ', plan: 260, actual: 195, brands: [
      { name: 'KIA', plan: 140, actual: 100 },
      { name: 'Mazda', plan: 120, actual: 95 },
    ]},
  ],
};

function StatusIcon({ pct }: { pct: number }) {
  if (pct > 100) return <XCircle size={14} style={{ color: 'var(--color-danger)' }} />;
  if (pct > 80) return <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />;
  return <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />;
}

export default function BudgetPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (name: string) =>
    setExpanded((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  const totalPlan = DEMO.showrooms.reduce((s, r) => s + r.plan, 0);
  const totalActual = DEMO.showrooms.reduce((s, r) => s + r.actual, 0);
  const totalPct = totalPlan > 0 ? totalActual / totalPlan * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: 8 }}>
      <PageHeader
        title="Kiểm soát Ngân sách Marketing"
        year={year}
        month={month}
        viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={setViewMode}
        actions={
          <>
            <button className="button-erp-primary">Nạp dữ liệu</button>
            <button className="button-erp-secondary">In báo cáo</button>
          </>
        }
      />

      {/* Summary Stats - Compact ERP KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <div className="panel" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Kế hoạch năm</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-brand)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatNumber(totalPlan * 12)}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, color: 'var(--color-text-muted)' }}>tr</span></div>
        </div>
        <div className="panel" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Thực hiện tháng</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatNumber(totalActual)}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, color: 'var(--color-text-muted)' }}>tr</span></div>
        </div>
        <div className="panel" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Còn lại tháng</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-info)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatNumber(totalPlan - totalActual)}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3, color: 'var(--color-text-muted)' }}>tr</span></div>
        </div>
        <div className="panel" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Tỷ lệ thực hiện</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{totalPct.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 1, color: 'var(--color-text-muted)' }}>%</span></div>
        </div>
      </div>

      {/* Main Grid Panel */}
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="toolbar">
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-table)', color: 'var(--color-text)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Biểu kiểm soát ngân sách chi tiết</span>
          <div style={{ flex: 1 }} />
          <div className="period-tabs">
            <button className="period-tab active">Tất cả đơn vị</button>
            <button className="period-tab">Vượt ngân sách</button>
          </div>
        </div>

        <div className="table-scroll-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 30, textAlign: 'center' }}></th>
                <th style={{ width: 40, textAlign: 'center' }}>STT</th>
                <th>Showroom / Thương hiệu</th>
                <th style={{ width: 120, textAlign: 'right' }}>Kế hoạch (tr)</th>
                <th style={{ width: 120, textAlign: 'right' }}>Thực hiện (tr)</th>
                <th style={{ width: 120, textAlign: 'right' }}>Còn lại (tr)</th>
                <th style={{ width: 100, textAlign: 'center' }}>Tỷ lệ (%)</th>
                <th>Tiến độ</th>
                <th style={{ width: 40, textAlign: 'center' }}>TT</th>
              </tr>
            </thead>
            <tbody>
              {DEMO.showrooms.map((sr, idx) => {
                const pct = sr.plan > 0 ? sr.actual / sr.plan * 100 : 0;
                const remaining = sr.plan - sr.actual;
                const isExpanded = expanded.includes(sr.name);

                return (
                  <React.Fragment key={sr.name}>
                    <tr 
                      className={isExpanded ? 'active' : ''} 
                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(0,114,198,0.05)' : 'white' }}
                      onClick={() => toggle(sr.name)}
                    >
                      <td style={{ textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </td>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-brand)' }}>{sr.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(sr.plan)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(sr.actual)}</td>
                      <td style={{ textAlign: 'right', color: remaining < 0 ? '#ef4444' : '#64748b' }}>
                        {remaining < 0 ? `+${formatNumber(Math.abs(remaining))}` : formatNumber(remaining)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: 10, 
                          padding: '1px 4px', 
                          background: pct > 100 ? '#fee2e2' : pct > 80 ? '#fef3c7' : '#dcfce7',
                          color: pct > 100 ? '#b91c1c' : pct > 80 ? '#92400e' : '#166534',
                          border: '1px solid currentColor',
                          borderRadius: 2
                        }}>
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                      <td>
                        <div style={{ width: '100%', height: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', position: 'relative' }}>
                          <div style={{ 
                            width: `${Math.min(pct, 100)}%`, 
                            background: pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#3b82f6', 
                            height: '100%' 
                          }} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusIcon pct={pct} />
                      </td>
                    </tr>

                    {isExpanded && sr.brands.map((brand, bIdx) => {
                      const bPct = brand.plan > 0 ? brand.actual / brand.plan * 100 : 0;
                      return (
                        <tr key={`${sr.name}-${brand.name}`} style={{ background: '#f8fafc' }}>
                          <td></td>
                          <td style={{ textAlign: 'center', opacity: 0.5 }}>{idx + 1}.{bIdx + 1}</td>
                          <td style={{ paddingLeft: 24, fontStyle: 'italic', color: '#475569' }}>
                            └ {brand.name}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>{formatNumber(brand.plan)}</td>
                          <td style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>{formatNumber(brand.actual)}</td>
                          <td style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                            {formatNumber(brand.plan - brand.actual)}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: 10 }}>{bPct.toFixed(0)}%</td>
                          <td>
                            <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(bPct, 100)}%`, background: '#94a3b8', height: '100%' }} />
                            </div>
                          </td>
                          <td></td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Grand Total Row */}
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td></td>
                <td></td>
                <td style={{ textTransform: 'uppercase' }}>Tổng cộng toàn công ty</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(totalPlan)}</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(totalActual)}</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(totalPlan - totalActual)}</td>
                <td style={{ textAlign: 'center' }}>{totalPct.toFixed(1)}%</td>
                <td colSpan={2}>
                  <div style={{ width: '100%', height: 12, background: 'white', border: '1px solid #cbd5e1' }}>
                    <div style={{ width: `${Math.min(totalPct, 100)}%`, background: 'var(--color-brand)', height: '100%' }} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bravo status bar */}
        <div style={{ height: 24, background: '#e2e8f0', borderTop: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 10, color: '#475569' }}>
          <div style={{ flex: 1, paddingLeft: 10 }}>Sẵn sàng | Đang xem báo cáo quản trị ngân sách v2.0</div>
          <div style={{ borderLeft: '1px solid #cbd5e1', height: '100%', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
            User: {DEMO_USER}
          </div>
          <div style={{ borderLeft: '1px solid #cbd5e1', height: '100%', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
            8/4/2026
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_USER = "NGUYÊN XUÂN NGỌC";
