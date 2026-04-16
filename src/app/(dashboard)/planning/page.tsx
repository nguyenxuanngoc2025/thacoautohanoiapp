'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber, cn } from '@/lib/utils';
import { CHANNEL_CATEGORIES } from '@/lib/constants';
import { DownloadCloud, UploadCloud, Save, Send, Copy, Wallet, Users, FileSignature, BarChart3, Wand2, Zap, X, CheckCircle2, AlertTriangle, Edit2, Trash2, ArrowUpRight, CalendarDays, Keyboard, ChevronDown, CloudUpload } from 'lucide-react';
import { Badge } from '@/components/reui/badge';
import EventFormModal from '@/components/events/EventFormModal';
import { type EventItem, EVENT_CPL, EVENT_CR1, EVENT_CR2, fetchEventsFromDB, upsertEventToDB, deleteEventFromDB } from '@/lib/events-data';
import { fetchAllBudgetPlans, upsertBudgetPlan } from '@/lib/budget-data';
import { computeHistoricalCPL, fetchAllActualEntries, upsertActualEntry } from '@/lib/actual-data';
import { MASTER_BRANDS } from '@/lib/master-data';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';
import { useChannels, type Channel } from '@/contexts/ChannelsContext';
import type { BrandWithModels } from '@/lib/brands-data';


// CHANNELS được cung cấp động bởi ChannelsContext — xem useChannels() bên dưới
// Giữ lại METRICS, COL_WIDTH và helper function ở đây

const METRICS = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'];

// Fixed widths for sticky columns
const COL1_WIDTH = 90;
const COL2_WIDTH = 120;

// Channel category color map (fallback only for categories without channel-level color)
const CATEGORY_COLOR_MAP: Record<string, string> = {};
CHANNEL_CATEGORIES.forEach(c => { CATEGORY_COLOR_MAP[c.value] = c.color; });

// SR_WEIGHTS now provided by useShowrooms().weightMap — see inside component

// Build ordered cellKeys for keyboard navigation
function buildCellKeysList(brands: BrandWithModels[], channels: { name: string; readonly: boolean }[]): string[] {
  const keys: string[] = [];
  for (const brand of brands) {
    for (const model of brand.models) {
      const isAgg = brand.modelData?.find(x => x.name === model)?.is_aggregate;
      if (isAgg) continue;
      for (const ch of channels) {
        if (ch.readonly) continue;
        for (const metric of METRICS) {
          keys.push(`${brand.name}-${model}-${ch.name}-${metric}`);
        }
      }
    }
  }
  return keys;
}

interface CellData {
  [key: string]: number;
}

// --- Types hoisted out of component for performance ---
type EventModalState = 
  | { open: true;  data: EventItem; isNew: boolean }
  | { open: false; data: null;      isNew: boolean };
type AlertState = { type: 'warning' | 'success' | 'info', title: string, message: string };

// Deterministic mockup data generation (kênh "Sự kiện" KHÔNG generate ở đây
// vì được driven 100% từ events[] qua useEffect sync)
// LƯU Ý: Đây là hàm helper ngoài component nên dùng STATIC channel list
// Context sẽ ghi đè dữ liệu thực tế sau khi fetch xong
const STATIC_CHANNELS_FOR_MOCKUP = [
  { name: 'Google',      category: 'DIGITAL',    color: '#EA4335', readonly: false, isAggregate: false },
  { name: 'Facebook',    category: 'DIGITAL',    color: '#1877F2', readonly: false, isAggregate: false },
  { name: 'Khác',        category: 'DIGITAL',    color: '#64748B', readonly: false, isAggregate: false },
  { name: 'Tổng Digital',category: 'DIGITAL',    color: '#0F172A', readonly: true,  isAggregate: true  },
  { name: 'Sự kiện',   category: 'SỰ KIỆN',   color: '#10B981', readonly: true,  isAggregate: false },
  { name: 'CSKH',        category: 'CSKH',       color: '#F59E0B', readonly: false, isAggregate: false },
  { name: 'Nhận diện', category: 'NHẬN DIỆN', color: '#8B5CF6', readonly: false, isAggregate: false },
];

type CellNotes = Record<string, string>;

function generateMockData(monthSeed: number, brands?: BrandWithModels[]): CellData {
  // Dùng MASTER_BRANDS làm fallback khi brands chưa load từ DB
  const activeBrands: BrandWithModels[] = brands ?? MASTER_BRANDS.map(b => ({ name: b.name, color: null, models: b.models, modelData: [] }));

  const data: CellData = {};
  
  const brandW: Record<string, number> = { 'KIA': 0.35, 'Mazda': 0.25, 'Peugeot': 0.1, 'BMW': 0.08, 'MINI': 0.02, 'TẢI BUS': 0.18, 'BMW MTR': 0.02 };
  const modelW: Record<string, number> = {
    // KIA — 10 dòng xe
    'New Carnival': 0.20, 'Sportage': 0.15, 'Carens': 0.05,
    'New Sonet': 0.10, 'New Seltos': 0.15, 'New Sorento': 0.10,
    'Kia K5': 0.05, 'New Morning': 0.08, 'K3': 0.08, 'Soluto': 0.04,
    // Mazda — 8 dòng xe
    'CX-90': 0.05, 'MX-5': 0.02, 'Mazda CX-8': 0.15, 'Mazda CX-5': 0.35,
    'Mazda3': 0.18, 'CX-3': 0.05, 'CX-30': 0.12, 'Mazda2': 0.08,
    // Peugeot — 4 dòng xe
    '408': 0.15, '2008': 0.20, '3008': 0.40, '5008': 0.25,
    // BMW (nhóm) — 3 phân khúc
    'Nhóm doanh số chính': 0.60, 'Nhóm cao cấp': 0.30, 'Nhóm Clear stock': 0.10,
    // MINI — 4 dòng
    '3-Cửa': 0.35, '5-Cửa': 0.30, 'Mui trần': 0.15, 'Countryman': 0.20,
    // BMW MTR — 2 dòng
    'Nhóm xe hiện hữu': 0.60, 'Nhóm xe mới': 0.40,
    // TẢI BUS — 6 dòng xe có dữ liệu (không có Tổng Tải/Tổng Bus)
    'Tải nhẹ máy xăng': 0.20, 'Tải van': 0.18, 'Tải nhẹ máy dầu': 0.22,
    'Tải trung': 0.20, 'TN ĐK BN': 0.10, 'Bus': 0.06, 'Mini Bus': 0.04,
  };
  // Kênh Sự kiện bị loại khỏi mockup — driven by events[]
  const chW: Record<string, number> = { 'Facebook': 0.40, 'Google': 0.30, 'Khác': 0.06, 'CSKH': 0.12, 'Nhận diện': 0.12 };
  const baseBudget = 3000;
  
  for (const b of activeBrands) {
    const bw = brandW[b.name] || 0.2;
    for (const m of b.models) {
      const isAgg = b.modelData?.find(x => x.name === m)?.is_aggregate;
      if (isAgg) continue;
      const mw = modelW[m] || (1 / b.models.length);
      const mBdgt = baseBudget * bw * mw;
      for (const c of STATIC_CHANNELS_FOR_MOCKUP) {
        if (c.name === 'Tổng Digital') continue;
        if (c.name === 'Sự kiện') continue; // Sự kiện do events[] driver
        
        const key = `${b.name}-${m}-${c.name}`;
        let hash = 0;
        const hashStr = key + monthSeed;
        for (let i = 0; i < hashStr.length; i++) hash = Math.imul(31, hash) + hashStr.charCodeAt(i) | 0;
        const noise = ((Math.abs(hash) % 100) / 100) * 0.4 + 0.8;
        
        if (['Khác', 'Nhận diện', 'CSKH'].includes(c.name) && (Math.abs(hash) % 10) < 4) continue;

        const cw = chW[c.name] || 0.1;
        const budget = Math.round(mBdgt * cw * noise * 10) / 10;
        const cpl = c.name === 'Facebook' ? 0.08 : c.name === 'Google' ? 0.12 : 0.15;
        
        const khqt = Math.round(budget / cpl);
        const cr1 = 0.15;
        const gdtd = Math.round(khqt * cr1);
        const khd = Math.round(gdtd * (c.name === 'CSKH' ? 0.5 : 0.25));

        if (budget > 0) data[`${key}-Ngân sách`] = budget;
        if (khqt > 0) data[`${key}-KHQT`] = khqt;
        if (gdtd > 0) data[`${key}-GDTD`] = gdtd;
        if (khd > 0) data[`${key}-KHĐ`] = khd;
      }
    }
  }
  return data;
}

const CellNoteEditor = ({ initialValue, onSave, onCancel, onDelete }: { initialValue: string, onSave: (val: string) => void, onCancel: () => void, onDelete: () => void }) => {
  const [val, setVal] = useState(initialValue);
  const isEditingExisting = !!initialValue;
  
  return (
    <div 
      style={{ position: 'absolute', top: -40, right: -10, zIndex: 200, display: 'flex', flexWrap: 'nowrap', gap: 4, background: '#fff', padding: 6, borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--color-border-dark)', boxShadow: 'var(--shadow-dropdown)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input 
        type="text"
        className="form-input"
        autoFocus
        placeholder="Nhập ghi chú..."
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
             if (val.trim() === '') onDelete();
             else onSave(val);
          }
          if (e.key === 'Escape') onCancel();
        }}
        style={{ width: 300 }}
      />
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <button onClick={() => val.trim() === '' ? onDelete() : onSave(val)} title="Lưu" style={{ color: '#059669', background: '#ecfdf5', borderRadius: 4, border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <CheckCircle2 size={16} />
        </button>
        {isEditingExisting && (
          <button onClick={onDelete} title="Xóa ghi chú này" style={{ color: '#dc2626', background: '#fef2f2', borderRadius: 4, border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={onCancel} title="Hủy bỏ" style={{ color: '#64748b', background: '#f8fafc', borderRadius: 4, border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const FilterDropdown = ({
  label,
  value,
  options,
  onChange,
  width = 120,
  isMulti = false,
  placeholder = '— Tất cả —'
}: {
  label: string,
  value: string | string[],
  options: { value: string, label: string }[],
  onChange: (val: any) => void,
  width?: number | string,
  isMulti?: boolean,
  placeholder?: string
}) => {
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
        style={{ width, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: 26, cursor: 'pointer', background: '#fff', border: isOpen ? '1px solid var(--color-brand)' : undefined }}
      >
        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel()}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>
      
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: label ? 50 : 0, marginTop: 4, width: typeof width === 'number' ? Math.max(width, 220) : '100%', minWidth: 220, background: '#fff', border: '1px solid var(--color-border-dark)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'scaleInId 0.15s ease-out', transformOrigin: 'top left' }}>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {isMulti ? (
              <>
                <div
                  style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-brand)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}
                  onClick={() => setLocalVal([])}
                >
                  Bỏ chọn tất cả
                </div>
                {options.map(o => {
                  const arr = (localVal ?? value) as string[];
                  const isChecked = arr.includes(o.value);
                  return (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f1f5f9', margin: 0 }}>
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
                  style={{ padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f1f5f9', background: value === o.value ? '#f0f9ff' : 'transparent', color: value === o.value ? 'var(--color-brand)' : 'inherit' }}
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
            <div style={{ padding: 8, borderTop: '1px solid var(--color-border)', background: '#f8fafc' }}>
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
};


export default function PlanningPage() {
  // ─── Dynamic brands từ DB (thay thế DEMO_BRANDS tĩnh) ───────────────────────
  const { brands } = useBrands();
  // ─── Dynamic showrooms từ DB (thay thế MASTER_SHOWROOMS hard-coded) ──────────
  const { showrooms, weightMap: SR_WEIGHTS, showroomNames: SHOWROOMS } = useShowrooms();
  const { activeUnitId } = useUnit();
  // ─── Dynamic channels từ DB (thay thế CHANNELS hard-coded) ──────────────────
  const { channels: CHANNELS, digitalChannelNames } = useChannels();

  const [mounted, setMounted] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedShowroom, setSelectedShowroom] = useState('all');

  // Alias để tất cả code cũ hoạt động không đổi - được lọc qua ràng buộc brands của showroom
  const DEMO_BRANDS = useMemo(() => {
    if (selectedShowroom === 'all') return brands;
    const sr = showrooms.find(s => s.name === selectedShowroom);
    if (!sr || !sr.brands || sr.brands.length === 0) return brands; 
    return brands.filter(b => sr.brands.includes(b.name));
  }, [brands, selectedShowroom, showrooms]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState('none');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingNoteCell, setEditingNoteCell] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<CellData[]>([]);

  // Spreadsheet Selection State
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStartIdx, setSelectionStartIdx] = useState<number>(-1);

  
  const availableModels = useMemo(() => {
    if (selectedBrand === 'all') return Array.from(new Set(brands.flatMap(b => b.models)));
    return brands.find(b => b.name === selectedBrand)?.models || [];
  }, [selectedBrand, brands]);

  // Group 3: State for Notes
  const [notesByMonth, setNotesByMonth] = useState<Record<number, Record<string, string>>>({});

  // Store generated mockup data for all 12 months locally
  const [dataByMonth, setDataByMonth] = useState<Record<number, CellData>>(() => {
    const initData: Record<number, CellData> = {};
    for (let m = 1; m <= 12; m++) {
      if (m <= 6) {
        initData[m] = generateMockData(m);
      } else {
        initData[m] = {};
      }
    }
    return initData;
  });

  const [approvalStatuses, setApprovalStatuses] = useState<Record<number, string>>({});
  const approvalStatus = (approvalStatuses[month] as 'draft' | 'pending' | 'approved') || 'draft';
  const setApprovalStatus = (st: 'draft' | 'pending' | 'approved') => {
      setApprovalStatuses(prev => ({ ...prev, [month]: st }));
  }

  // ─── Mode switcher: KẾ HOẠCH / THỰC HIỆN ─────────────────────────────────
  const [pageMode, setPageMode] = useState<'plan' | 'actual'>('plan');

  // Actual entries data
  const [actualDataByMonth, setActualDataByMonth] = useState<Record<number, CellData>>({});
  const [actualStatusByMonth, setActualStatusByMonth] = useState<Record<number, string>>({});
  // Dirty tracking — true khi user edit actual data chưa được lưu
  const [isDirtyActual, setIsDirtyActual] = useState(false);
  // Snapshot để hỗ trợ discard changes
  const lastSavedActualSnapshot = useRef<CellData | null>(null);

  // Mode-aware cell data
  const cellData = pageMode === 'plan'
    ? (dataByMonth[month] || {})
    : (actualDataByMonth[month] || {});

  // Plan data luôn available để hiện ghost value trong actual mode
  const planCellData = dataByMonth[month] || {};

  // ─── Edit lock guard (mode-aware) ────────────────────────────────────────
  // Plan mode: locked khi showroom = 'all' HOẶC kế hoạch không ở draft
  // Actual mode: locked khi entry đã submitted
  const isDataLocked = pageMode === 'plan'
    ? (selectedShowroom === 'all' || approvalStatus !== 'draft')
    : (actualStatusByMonth[month] || 'draft') === 'submitted';

  // Actual split mode: draft months show Plan | Actual 2-column layout
  const isActualSplitMode = pageMode === 'actual' && (actualStatusByMonth[month] || 'draft') === 'draft';

  const setCellData = useCallback((action: React.SetStateAction<CellData>) => {
    if (pageMode === 'plan') {
      setDataByMonth(prev => {
        const current = prev[month] || {};
        const next = typeof action === 'function' ? action(current) : action;
        return { ...prev, [month]: next };
      });
    } else {
      setActualDataByMonth(prev => {
        const current = prev[month] || {};
        const next = typeof action === 'function' ? action(current) : action;
        return { ...prev, [month]: next };
      });
      setIsDirtyActual(true);
    }
  }, [month, pageMode]);

  const currentWeight = useMemo(() => {
    return selectedShowroom === 'all' ? 1 : (SR_WEIGHTS[selectedShowroom] || 1);
  }, [selectedShowroom]);



  const getRawHistoricalValue = useCallback((cellKey: string, mode: string): number | null => {
    if (mode === 'none') return null;

    // So sánh với Kế hoạch tháng hiện tại → % đạt
    if (mode === 'vs_plan') {
      const planData = dataByMonth[month] || {};
      if (cellKey.includes('-Tổng Digital-')) {
        return digitalChannelNames.reduce((sum, chName) =>
          sum + (planData[cellKey.replace('-Tổng Digital-', `-${chName}-`)] || 0), 0
        );
      }
      for (const b of brands) {
        if (!b.modelData) continue;
        for (const m of b.modelData) {
          if (m.is_aggregate && m.aggregate_group) {
            const prefix = `${b.name}-${m.name}-`;
            if (cellKey.startsWith(prefix)) {
              const suffix = cellKey.slice(prefix.length - 1);
              const targetModels = b.modelData
                .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
                .map(sub => sub.name);
              return targetModels.reduce((sum, mName) => sum + (planData[`${b.name}-${mName}${suffix}`] || 0), 0);
            }
          }
        }
      }
      return planData[cellKey] || 0;
    }

    // So sánh TH với TH tháng trước
    if (mode === 'prev_actual') {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevActual = actualDataByMonth[prevMonth] || {};
      if (cellKey.includes('-Tổng Digital-')) {
        return digitalChannelNames.reduce((sum, chName) =>
          sum + (prevActual[cellKey.replace('-Tổng Digital-', `-${chName}-`)] || 0), 0
        );
      }
      for (const b of brands) {
        if (!b.modelData) continue;
        for (const m of b.modelData) {
          if (m.is_aggregate && m.aggregate_group) {
            const prefix = `${b.name}-${m.name}-`;
            if (cellKey.startsWith(prefix)) {
              const suffix = cellKey.slice(prefix.length - 1);
              const targetModels = b.modelData
                .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
                .map(sub => sub.name);
              return targetModels.reduce((sum, mName) => sum + (prevActual[`${b.name}-${mName}${suffix}`] || 0), 0);
            }
          }
        }
      }
      return prevActual[cellKey] || 0;
    }

    if (mode === 'prev_month' || mode === 'prev_period') {
      const prevMonth = month === 1 ? 12 : month - 1;
      
      if (cellKey.includes('-Tổng Digital-')) {
        // Dynamic: dùng tên kênh digital từ ChannelsContext thay vì cứng
        return digitalChannelNames.reduce((sum, chName) =>
          sum + (dataByMonth[prevMonth]?.[cellKey.replace('-Tổng Digital-', `-${chName}-`)] || 0), 0
        );
      }
      
      // Dynamic Model Aggregation
      for (const b of brands) {
        if (!b.modelData) continue;
        for (const m of b.modelData) {
          if (m.is_aggregate && m.aggregate_group) {
            const prefix = `${b.name}-${m.name}-`;
            if (cellKey.startsWith(prefix)) {
              const suffix = cellKey.slice(prefix.length - 1);
              const targetModels = b.modelData
                .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
                .map(sub => sub.name);
              return targetModels.reduce((sum, mName) => sum + (dataByMonth[prevMonth]?.[`${b.name}-${mName}${suffix}`] || 0), 0);
            }
          }
        }
      }
      return dataByMonth[prevMonth]?.[cellKey] || 0;
    }

    const computeBase = (key: string) => {
      const isBudget = key.endsWith('-Ngân sách');
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = Math.imul(31, hash) + key.charCodeAt(i) | 0;
      const seededRand = (Math.abs(hash) % 100) / 100;
      if (seededRand < 0.3) return 0;
      
      const currentVal = cellData[key] || 0;
      if (currentVal > 0) {
          return isBudget 
             ? Math.round(currentVal * (0.8 + (seededRand * 0.35)) * 10) / 10
             : Math.max(1, Math.round(currentVal * (0.8 + (seededRand * 0.35))));
      }
      return 0; 
    };

    if (cellKey.includes('-Tổng Digital-')) {
      // Dynamic: dùng tên kênh digital từ ChannelsContext thay vì cứng
      return digitalChannelNames.reduce((sum, chName) =>
        sum + computeBase(cellKey.replace('-Tổng Digital-', `-${chName}-`)), 0
      );
    }
    
    // Dynamic Model Aggregation
    for (const b of brands) {
      if (!b.modelData) continue;
      for (const m of b.modelData) {
        if (m.is_aggregate && m.aggregate_group) {
          const prefix = `${b.name}-${m.name}-`;
          if (cellKey.startsWith(prefix)) {
            const suffix = cellKey.slice(prefix.length - 1);
            const targetModels = b.modelData
              .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
              .map(sub => sub.name);
            return targetModels.reduce((sum, mName) => sum + computeBase(`${b.name}-${mName}${suffix}`), 0);
          }
        }
      }
    }

    return computeBase(cellKey);
  }, [dataByMonth, actualDataByMonth, month, cellData, brands, digitalChannelNames]);

  const getHistoricalValue = useCallback((cellKey: string, mode: string): number | null => {
    const raw = getRawHistoricalValue(cellKey, mode);
    if (raw === null || currentWeight === 1) return raw;
    const scaled = raw * currentWeight;
    const isBudget = cellKey.endsWith('-Ngân sách') || cellKey.endsWith('-CPL');
    return isBudget ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }, [getRawHistoricalValue, currentWeight]);

  const calculateDelta = (curr: number, hist: number | null) => {
    if (hist === null) return null;
    if (hist === 0 && curr === 0) return 0;
    if (hist === 0) return 100;
    return Math.round(((curr - hist) / hist) * 100);
  };

  const renderDualValue = (val: number, histVal: number | null, isEditing: boolean) => {
    if (histVal === null) {
      return (
        <span style={{ color: val > 0 ? 'var(--color-text)' : 'transparent', userSelect: val > 0 ? 'auto' : 'none' }}>
          {val > 0 ? formatNumber(val) : ''}
        </span>
      );
    }

    // Mode vs_plan: hiện % đạt (TH/KH) thay vì delta
    if (compareMode === 'vs_plan') {
      const pct = histVal > 0 ? Math.round((val / histVal) * 100) : (val > 0 ? 100 : 0);
      const pctColor = pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', lineHeight: 1.2, gap: 2, height: '100%', opacity: isEditing ? 0 : 1 }}>
          <span style={{ color: val > 0 ? 'var(--color-text)' : 'transparent', fontWeight: val > 0 ? 600 : 400 }}>
            {val > 0 ? formatNumber(val) : ''}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '-0.02em' }}>
            KH:{histVal > 0 ? formatNumber(histVal) : '0'}
            <span style={{ color: pctColor, fontSize: 9, fontWeight: 700, background: `${pctColor}18`, padding: '0 3px', borderRadius: 2 }}>
              {pct}%
            </span>
          </span>
        </div>
      );
    }

    const delta = calculateDelta(val, histVal);
    const isPositive = delta! > 0;
    const isNegative = delta! < 0;
    const deltaColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--color-text-muted)';
    const deltaIcon = isPositive ? '▲' : isNegative ? '▼' : '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', lineHeight: 1.2, gap: 2, height: '100%', opacity: isEditing ? 0 : 1 }}>
        <span style={{ color: val > 0 ? 'var(--color-text)' : 'transparent', fontWeight: val > 0 ? 600 : 400 }}>
          {val > 0 ? formatNumber(val) : ''}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '-0.02em' }}>
          {histVal > 0 ? formatNumber(histVal) : '0'}
          <span style={{ color: deltaColor, fontSize: 9, fontWeight: 700 }}>
            {delta !== 0 ? `${deltaIcon}${Math.abs(delta!)}%` : '—'}
          </span>
        </span>
      </div>
    );
  };

  const [isScrolled, setIsScrolled] = useState(false);
  // Collapsed brand rows: Set of brand names
  const [collapsedBrands, setCollapsedBrands] = useState<Set<string>>(new Set());
  // Hidden channel categories (chip filter): Set of category names
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  // DIGITAL sub-group collapse (header click only)
  const [digitalCollapsed, setDigitalCollapsed] = useState(false);
  // Metric columns visibility
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(new Set());
  
  // Events — lưu theo tháng, KHQT/GDTD/KHĐ được derive từ cellData
  const [eventsByMonth, setEventsByMonth] = useState<Record<number, EventItem[]>>({});

  const loadData = useCallback(async () => {
    const [eventsData, budgetPlans, cplData, actualEntries] = await Promise.all([
      fetchEventsFromDB(activeUnitId),
      fetchAllBudgetPlans(activeUnitId),
      computeHistoricalCPL(year, activeUnitId),
      fetchAllActualEntries(year, activeUnitId),
    ]);
    if (Object.keys(cplData).length > 0) setHistoricalCPL(cplData);
    else setHistoricalCPL({});
    
    setEventsByMonth(eventsData);

    // Load budget plans — reset trước để tránh data từ chi nhánh/năm cũ còn lại
    const newData: Record<number, CellData> = {};
    const newNotes: Record<number, CellNotes> = {};
    const newApproval: Record<number, string> = {};

    if (budgetPlans && budgetPlans.length > 0) {
      budgetPlans.forEach(p => {
        if (Object.keys(p.payload).length > 0) newData[p.month] = p.payload;
        if (Object.keys(p.notes).length > 0) newNotes[p.month] = p.notes;
        newApproval[p.month] = p.approval_status;
      });
    }

    setDataByMonth(newData);
    setNotesByMonth(newNotes);
    setApprovalStatuses(newApproval);

    // Load actual entries — reset trước để tránh data từ năm cũ còn lại
    const newActualData: Record<number, CellData> = {};
    const newActualStatus: Record<number, string> = {};
    if (actualEntries && actualEntries.length > 0) {
      actualEntries.forEach(a => {
        if (Object.keys(a.payload).length > 0) newActualData[a.month] = a.payload;
        newActualStatus[a.month] = a.status;
      });
    }
    setActualDataByMonth(newActualData);
    setActualStatusByMonth(newActualStatus);
  }, [year, activeUnitId]);

  // Auto-save plan data (debounce 1.5s)
  const lastSavedPayload = useRef<string>('');
  React.useEffect(() => {
    if (!mounted || pageMode !== 'plan') return;
    if (!activeUnitId || activeUnitId === 'all') return; // Không save khi xem tổng hợp
    const currentPayload = dataByMonth[month];
    const currentNotes = notesByMonth[month] || {};
    if (!currentPayload || Object.keys(currentPayload).length === 0) return;
    const payloadStr = JSON.stringify({ currentPayload, currentNotes, approvalStatus });
    if (payloadStr === lastSavedPayload.current) return;
    const timeout = setTimeout(() => {
      upsertBudgetPlan(month, currentPayload, currentNotes, approvalStatus, activeUnitId === 'all' ? undefined : activeUnitId).then(success => {
        if (success) lastSavedPayload.current = payloadStr;
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [dataByMonth, notesByMonth, approvalStatus, month, mounted, pageMode, activeUnitId]);

  // Reset dirty flag khi chuyển tháng
  React.useEffect(() => {
    setIsDirtyActual(false);
    // Lưu snapshot khi load actual data xong
    lastSavedActualSnapshot.current = actualDataByMonth[month] || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Handlers lưu/nộp actual (không auto-save — user phải bấm)
  const handleSaveActual = useCallback(async () => {
    const payload = actualDataByMonth[month] || {};
    const ok = await upsertActualEntry(month, year, payload, {}, 'draft', activeUnitId === 'all' ? undefined : activeUnitId);
    if (ok) {
      setIsDirtyActual(false);
      lastSavedActualSnapshot.current = { ...payload };
      setAlertInfo({ type: 'success', title: 'Lưu thành công', message: `Số thực hiện tháng ${month} đã được lưu nháp.` });
    } else {
      setAlertInfo({ type: 'warning', title: 'Lỗi lưu dữ liệu', message: 'Không thể lưu vào hệ thống. Kiểm tra kết nối và thử lại.' });
    }
  }, [actualDataByMonth, month, year, activeUnitId]);

  const handleSubmitActual = useCallback(async () => {
    const payload = actualDataByMonth[month] || {};
    if (Object.keys(payload).length === 0) {
      setAlertInfo({ type: 'warning', title: 'Chưa có dữ liệu', message: 'Chưa có số liệu thực hiện để nộp.' });
      return;
    }
    const ok = await upsertActualEntry(month, year, payload, {}, 'submitted', activeUnitId === 'all' ? undefined : activeUnitId);
    if (ok) {
      setIsDirtyActual(false);
      lastSavedActualSnapshot.current = { ...payload };
      setActualStatusByMonth(prev => ({ ...prev, [month]: 'submitted' }));
      setAlertInfo({ type: 'success', title: 'Nộp thành công', message: `Số thực hiện tháng ${month} đã được nộp và chốt.` });
    } else {
      setAlertInfo({ type: 'warning', title: 'Lỗi nộp dữ liệu', message: 'Không thể nộp. Kiểm tra kết nối và thử lại.' });
    }
  }, [actualDataByMonth, month, year, activeUnitId]);

  const handleDiscardActual = useCallback(() => {
    if (lastSavedActualSnapshot.current !== null) {
      setActualDataByMonth(prev => ({ ...prev, [month]: { ...lastSavedActualSnapshot.current! } }));
    } else {
      setActualDataByMonth(prev => { const n = { ...prev }; delete n[month]; return n; });
    }
    setIsDirtyActual(false);
  }, [month]);

  // Load on mount and focus
  React.useEffect(() => {
    loadData().then(() => { setMounted(true); setEventsLoaded(true); });
  }, [loadData]);

  React.useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  // Sprint 4: Load/save budget cap per month from localStorage
  React.useEffect(() => {
    if (!mounted) return;
    const stored = localStorage.getItem(`thaco_budget_cap_${month}_2026`);
    setBudgetCap(stored ? parseFloat(stored) : 0);
  }, [month, mounted]);

  const saveBudgetCap = (val: number) => {
    setBudgetCap(val);
    if (val > 0) localStorage.setItem(`thaco_budget_cap_${month}_2026`, String(val));
    else localStorage.removeItem(`thaco_budget_cap_${month}_2026`);
  };

  const events = eventsByMonth[month] || [];

  const getEventValueRaw = useCallback((brandName: string, modelName: string, metric: string): number => {
    let total = 0;
    for (const ev of events) {
      if (!ev) continue;
      let applyMultiplier = 0;
      if (selectedShowroom === 'all') { applyMultiplier = 1; }
      else {
        if (ev.showroom === 'all' || ev.showroom === 'Tất cả') applyMultiplier = SR_WEIGHTS[selectedShowroom] || 0;
        else if (ev.showroom === selectedShowroom) applyMultiplier = 1;
        else applyMultiplier = 0;
      }
      if (applyMultiplier === 0) continue;

      const touchedBrands = brands.filter(db => 
        ev.brands.includes(db.name) || db.models.some(m => ev.brands.includes(m))
      );
      const isGlobalEvent = touchedBrands.length === 0;
      
      const brandObj = brands.find(b => b.name === brandName);
      if (!brandObj) continue;

      if (!isGlobalEvent && !touchedBrands.includes(brandObj)) continue;

      const numBrands = isGlobalEvent ? brands.length : touchedBrands.length;
      
      const allBrandModels = brandObj.models.filter((m: string) => {
        const mObj = brandObj.modelData?.find((x: any) => x.name === m);
        return !mObj?.is_aggregate;
      });
      const selectedModelsForBrand = allBrandModels.filter((m: string) => ev.brands.includes(m));
      const targetModels = selectedModelsForBrand.length > 0 ? selectedModelsForBrand : allBrandModels;
      
      if (!targetModels.includes(modelName)) continue;

      const fraction = (1 / numBrands) * (1 / targetModels.length);
      
      let val = 0;
      if (metric === 'Ngân sách') val = ev.budget || 0;
      else if (metric === 'KHQT') val = ev.leads || 0;
      else if (metric === 'GDTD') val = ev.gdtd || 0;
      else if (metric === 'KHĐ')  val = ev.deals || 0;
      else if (metric === 'Lái thử') val = ev.testDrives || 0;

      total += val * fraction * applyMultiplier;
    }
    return total;
  }, [events, selectedShowroom, brands]);

  const getRawCellValue = useCallback((cellKey: string): number => {
    if (cellKey.includes('-Tổng Digital-')) {
      // Dynamic: dùng tên kênh digital từ ChannelsContext thay vì cứng
      return digitalChannelNames.reduce((sum, chName) =>
        sum + getRawCellValue(cellKey.replace('-Tổng Digital-', `-${chName}-`)), 0
      );
    }
    
    // Dynamic Model Aggregation
    for (const b of brands) {
      if (!b.modelData) continue;
      for (const m of b.modelData) {
        if (m.is_aggregate && m.aggregate_group) {
          const prefix = `${b.name}-${m.name}-`;
          if (cellKey.startsWith(prefix)) {
            const suffix = cellKey.slice(prefix.length - 1);
            const targetModels = b.modelData
              .filter(sub => sub.aggregate_group === m.aggregate_group && !sub.is_aggregate)
              .map(sub => sub.name);
            return targetModels.reduce((sum, mName) => sum + getRawCellValue(`${b.name}-${mName}${suffix}`), 0);
          }
        }
      }
    }
    // FIX: Dùng substring matching thay vì split('-') vì model names có thể chứa '-'
    // (VD: CX-5, CX-30, BT-50, 3-Cửa, 5-Cửa)
    const eventMarker = '-Sự kiện-';
    const evIdx = cellKey.indexOf(eventMarker);
    if (evIdx !== -1) {
      const brandModel = cellKey.substring(0, evIdx); // "Mazda-CX-30" hoặc "KIA-New Seltos"
      const metric = cellKey.substring(evIdx + eventMarker.length); // "Ngân sách", "KHQT"...
      const firstDash = brandModel.indexOf('-');
      if (firstDash !== -1) {
        const brandName = brandModel.substring(0, firstDash);
        const modelName = brandModel.substring(firstDash + 1);
        return getEventValueRaw(brandName, modelName, metric);
      }
    }
    return cellData[cellKey] || 0;
  }, [cellData, getEventValueRaw, brands]);

  const getUnroundedCellValue = useCallback((cellKey: string): number => {
    return getRawCellValue(cellKey);
  }, [getRawCellValue]);

  const getCellValue = useCallback((cellKey: string): number => {
    const raw = getRawCellValue(cellKey);
    
    // Sự kiện has already factored in showroom logic within getEventValueRaw!
    // So DO NOT multiply by currentWeight.
    // FIX: Dùng substring matching thay vì split('-') — tương tự getRawCellValue
    const isEvent = cellKey.includes('-Sự kiện-');
    const isBudget = cellKey.endsWith('-Ngân sách') || cellKey.endsWith('-CPL');
    
    if (isEvent || currentWeight === 1) {
       return isBudget ? Math.round(raw * 10) / 10 : Math.round(raw);
    }

    const scaled = raw * currentWeight;
    return isBudget ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }, [getRawCellValue, currentWeight]);

  const setEvents = useCallback((action: React.SetStateAction<EventItem[]>) => {
    setEventsByMonth(prev => {
      const current = prev[month] || [];
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [month]: next };
    });
  }, [month]);
  const [eventModal, setEventModal] = useState<EventModalState>({ open: false, data: null, isNew: false });
  // Hide rows with all-zero data
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [allocationModal, setAllocationModal] = useState<{ open: boolean, type: 'brand' | 'channel' | 'category', name: string } | null>(null);
  const [massPercent, setMassPercent] = useState<number>(15);
  const [alertInfo, setAlertInfo] = useState<AlertState | null>(null);

  const [confirmInfo, setConfirmInfo] = useState<{ type: 'save' | 'submit' | 'delete', title: string, message: string } | null>(null);
  const [pendingDeleteFn, setPendingDeleteFn] = useState<(() => void) | null>(null);

  // ── Sprint 3: Historical CPL ──────────────────────────────────────────────
  const [historicalCPL, setHistoricalCPL] = useState<Record<string, number>>({});

  // ── Sprint 4: Budget Cap ──────────────────────────────────────────────────
  // Giới hạn ngân sách tháng (triệu VND). User tự nhập, lưu localStorage theo month.
  const [budgetCap, setBudgetCap] = useState<number>(0);
  const [editingCap, setEditingCap] = useState(false);
  const [capInput, setCapInput] = useState('');

  const toggleBrand = (brandName: string) => {
    setCollapsedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandName)) next.delete(brandName);
      else next.add(brandName);
      return next;
    });
  };

  const toggleHiddenChannel = (category: string) => {
    setHiddenChannels(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const visibleMetrics = METRICS.filter(m => !hiddenMetrics.has(m));

  // Get visible channels based on digital collapse + hidden channel filter
  const visibleChannels = CHANNELS.filter(ch => {
    // Respect hidden category chips
    if (hiddenChannels.has(ch.category)) return false;
    // DIGITAL group: show sub-channels or just Tổng (aggregate)
    if (ch.category === 'DIGITAL') {
      if (digitalCollapsed) {
        return ch.name === 'Tổng Digital'; // Thu gọn: chỉ hiện Tổng
      }
      return true; // Phóng to: hiện tất cả (gồm cả Facebook, Google, Khác, Tổng Digital)
    }
    return true;
  });

  const VISIBLE_GRID_KEYS = useMemo(() => {
    const grid: string[][] = [];
    DEMO_BRANDS.forEach(b => {
      if (selectedBrand !== 'all' && b.name !== selectedBrand) return;
      if (!collapsedBrands.has(b.name)) {
        const sortedModels = [...b.models];
        const filteredBySelection = sortedModels.filter(model => selectedModels.length === 0 || selectedModels.includes(model));
        const displayModels = hideZeroRows
           ? filteredBySelection.filter(model =>
               CHANNELS.some(ch => ch.name !== 'Tổng Digital' && METRICS.some(m => getRawCellValue(`${b.name}-${model}-${ch.name}-${m}`) > 0))
             )
           : filteredBySelection;

        displayModels.forEach(m => {
          const rowKeys: string[] = [];
          visibleChannels.forEach(ch => {
            if (ch.readonly) return;
            visibleMetrics.forEach(metric => {
              rowKeys.push(`${b.name}-${m}-${ch.name}-${metric}`);
            });
          });
          grid.push(rowKeys);
        });
      }
    }); return grid;
  }, [brands, selectedBrand, selectedModels, collapsedBrands, visibleChannels, visibleMetrics, hideZeroRows, cellData]);
  
  const ALL_CELL_KEYS = useMemo(() => VISIBLE_GRID_KEYS.flat(), [VISIBLE_GRID_KEYS]);

  // mouseup listener is handled inside the global keyboard handler effect below

  

  const handleCellChange = (cellKey: string, value: string) => {
    let num = 0;
    const isBudget = cellKey.endsWith('-Ngân sách');
    
    if (value.trim() !== '') {
      const cleanValue = value.replace(/,/g, '.');
      num = parseFloat(cleanValue) || 0;
      
      if (!isBudget) num = Math.max(0, parseInt(value, 10)) || 0;
      else num = Math.max(0, num);
    }

    if (currentWeight !== 1) {
      num = num / currentWeight;
      if (!isBudget) num = Math.round(num); // Ensure global whole unit for customers
    }

    setCellData(prev => {
      const next = { ...prev, [cellKey]: num };
      
      // GOAL SEEK / TÍNH NGƯỢC (Nhóm 2)
      const parts = cellKey.split('-');
      if (parts.length >= 4) {
        const metric = parts.pop()!;
        const baseKey = parts.join('-');
        
        const FUNNEL = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'];
        const metricIdx = FUNNEL.indexOf(metric);
        
        if (metricIdx !== -1) {
          
          if (num >= 0) {
             // AUTO-FILL 2 chiều (Upstream & Downstream) 
             // Khi sửa 1 ô, các ô còn lại tự nhảy theo công thức tiêu chuẩn
             const cName = parts[parts.length - 1]; // "Facebook", "Google"
             // Sprint 3: Dùng historical CPL nếu có, fallback hardcoded
             const FALLBACK_CPL: Record<string, number> = { Facebook: 0.08, Google: 0.12 };
             const cpl = cName === 'Sự kiện' ? EVENT_CPL : (historicalCPL[cName] ?? FALLBACK_CPL[cName] ?? 0.15);
             const cr1 = (cName === 'Sự kiện') ? EVENT_CR1 : 0.15; // Leads to Deal
             // CR2: CSKH cao hơn (khách cũ), Sự kiện dùng EVENT_CR2, digital fallback 0.25
             const FALLBACK_CR2: Record<string, number> = { CSKH: 0.5, 'Sự kiện': EVENT_CR2 };
             const cr2 = FALLBACK_CR2[cName] ?? 0.25; // Deal to Contract

             if (metric === 'Ngân sách') {
                const khqt = Math.round(num / cpl);
                const gdtd = Math.round(khqt * cr1);
                const khd  = Math.round(gdtd * cr2);
                next[`${baseKey}-KHQT`] = khqt;
                next[`${baseKey}-GDTD`] = gdtd;
                next[`${baseKey}-KHĐ`]  = khd;
             } else if (metric === 'KHQT') {
                const ns = Math.round((num * cpl) * 10) / 10;
                const gdtd = Math.round(num * cr1);
                const khd  = Math.round(gdtd * cr2);
                next[`${baseKey}-Ngân sách`] = ns;
                next[`${baseKey}-GDTD`] = gdtd;
                next[`${baseKey}-KHĐ`]  = khd;
             } else if (metric === 'GDTD') {
                const khqt = Math.round(num / cr1);
                const ns = Math.round((khqt * cpl) * 10) / 10;
                const khd  = Math.round(num * cr2);
                next[`${baseKey}-Ngân sách`] = ns;
                next[`${baseKey}-KHQT`] = khqt;
                next[`${baseKey}-KHĐ`]  = khd;
             } else if (metric === 'KHĐ') {
                const gdtd = Math.round(num / cr2);
                const khqt = Math.round(gdtd / cr1);
                const ns = Math.round((khqt * cpl) * 10) / 10;
                next[`${baseKey}-Ngân sách`] = ns;
                next[`${baseKey}-KHQT`] = khqt;
                next[`${baseKey}-GDTD`] = gdtd;
             }
          }
           // NẾU !areOthersEmpty -> Người dùng chỉ CỐ TÌNH sửa ô này, không tự nhảy các ô khác => Dữ liệu đã gán next[cellKey] = num ở trên
        }
      }
      return next;
    });
  };

  // --- SYNC: Đã chuyển xử lý phân bổ ngân sách sự kiện sang getEventValueRaw ---

  // --- DERIVED: Đọc KPI trực tiếp từ event object (Single Source of Truth) ---
  const getEventDerived = useCallback((ev: EventItem) => {
    return {
      khqt: ev.leads || 0,
      gdtd: ev.gdtd || 0,
      khd:  ev.deals || 0,
      testDrives: ev.testDrives || 0,
    };
  }, []);


  const handleCellBlur = () => {
    setEditingCell(null);
  };

  // Global Keyboard Handler for Selection
  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      // Disable shortcuts when user is typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (selectedCells.size === 0) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isDataLocked) {
          setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu không thể xoá trong trạng thái hiện tại.' });
          return;
        }
        e.preventDefault();
        setCellData(prev => {
          setUndoStack(us => [...us.slice(-19), prev]); // LƯU LỊCH SỬ KHI XOÁ
          const next = { ...prev };
          selectedCells.forEach(key => {
             next[key] = 0;
          });
          return next;
        });
      }
      else if (e.ctrlKey || e.metaKey) {
         if (e.key === 'c' || e.key === 'C') {
             e.preventDefault();
             let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
             selectedCells.forEach(key => {
                 for(let r=0; r<VISIBLE_GRID_KEYS.length; r++) {
                     let c = VISIBLE_GRID_KEYS[r].indexOf(key);
                     if (c !== -1) {
                         if (r < minR) minR = r;
                         if (r > maxR) maxR = r;
                         if (c < minC) minC = c;
                         if (c > maxC) maxC = c;
                         break;
                     }
                 }
             });
             if (minR !== Infinity) {
                 const rows = [];
                 for(let r = minR; r <= maxR; r++) {
                     const colVals = [];
                     for(let c = minC; c <= maxC; c++) {
                         const cellKey = VISIBLE_GRID_KEYS[r][c];
                         if (selectedCells.has(cellKey)) colVals.push(getCellValue(cellKey));
                         else colVals.push(''); 
                     }
                     rows.push(colVals.join('\t'));
                 }
                 const clipText = rows.join('\n');
                 navigator.clipboard.writeText(clipText);
             }
         }
         else if (e.key === 'v' || e.key === 'V') {
             if (isDataLocked) {
               setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu không thể dán trong trạng thái hiện tại.' });
               return;
             }
             e.preventDefault();
             try {
                const text = await navigator.clipboard.readText();
                if (!text) return;
                
                const clipRows = text.split(/\r?\n/);
                // Tìm bounding box đích (minR, maxR, minC, maxC)
                let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                selectedCells.forEach(key => {
                    for(let r=0; r<VISIBLE_GRID_KEYS.length; r++) {
                        let c = VISIBLE_GRID_KEYS[r].indexOf(key);
                        if (c !== -1) {
                            if (r < minR) minR = r;
                            if (r > maxR) maxR = r;
                            if (c < minC) minC = c;
                            if (c > maxC) maxC = c;
                            break;
                        }
                    }
                });
                
                if (minR !== Infinity) {
                    setCellData(prev => {
                        setUndoStack(us => [...us.slice(-19), prev]); // LƯU LỊCH SỬ KHI DÁN
                        const next = { ...prev };
                        
                        const selRowCount = maxR - minR + 1;
                        const selColCount = maxC - minC + 1;
                        const srcRowCount = clipRows.length;
                        const srcColsFirst = clipRows[0].split('\t');
                        const srcColCount = srcColsFirst.length;
                        
                        // Smart paste lặp
                        const targetRows = (selRowCount > 1 && selRowCount % srcRowCount === 0) ? selRowCount : srcRowCount;
                        const targetCols = (selColCount > 1 && selColCount % srcColCount === 0) ? selColCount : srcColCount;
                        
                        for(let r = 0; r < targetRows; r++) {
                            for(let c = 0; c < targetCols; c++) {
                                const tr = minR + r;
                                const tc = minC + c;
                                if (tr < VISIBLE_GRID_KEYS.length && tc < VISIBLE_GRID_KEYS[0].length) {
                                    const cellKey = VISIBLE_GRID_KEYS[tr][tc];
                                    if (cellKey && !cellKey.includes('-Tổng')) {
                                        const sr = Math.min(r % srcRowCount, clipRows.length - 1);
                                        const srcRowData = clipRows[sr].split('\t');
                                        const sc = Math.min(c % srcColCount, srcRowData.length - 1);
                                        const rawVal = srcRowData[sc]?.trim().replace(/,/g, '');
                                        
                                        if (rawVal !== undefined && rawVal !== '') {
                                            const v = parseFloat(rawVal);
                                            if (!isNaN(v)) {
                                                let num = v;
                                                if (currentWeight !== 1) num = num / currentWeight;
                                                if (cellKey.endsWith('-KHQT') || cellKey.endsWith('-GDTD') || cellKey.endsWith('-KHĐ')) {
                                                    num = Math.round(num); // Ép kiểu số nguyên
                                                }
                                                next[cellKey] = num;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return next;
                    });
                }
             } catch (err) { console.error("Paste error", err); }
         }
         else if (e.key === 'z' || e.key === 'Z') {
             e.preventDefault();
             setUndoStack(us => {
                 if (us.length > 0) {
                     const prevState = us[us.length - 1];
                     setCellData(prevState);
                     setAlertInfo({ type: 'success', title: 'Hoàn tác', message: 'Dữ liệu đã được quay về trạng thái trước.' });
                     return us.slice(0, -1);
                 }
                 return us;
             });
         }
      }
      else if (e.key === 'Enter' || e.key === 'F2') {
         if (isDataLocked) {
           setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu đang bị khoá chỉnh sửa.' });
           return;
         }
         e.preventDefault();
         const first = Array.from(selectedCells)[0];     
         if (first) {
            setUndoStack(us => [...us.slice(-19), dataByMonth[month] || {}]);
            setEditingCell(first);
            setEditValue(currentWeight === 1 ? String(getCellValue(first) || '') : String((getCellValue(first) * currentWeight).toFixed(2)));
         }
      }
      else if (e.key.length === 1 && /[0-9\-]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
         if (isDataLocked) {
           setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Bạn không thể gõ dữ liệu trong trạng thái hiện tại.' });
           return;
         }
         e.preventDefault();
         if (!editingCell) {
             const first = Array.from(selectedCells)[0];     
             if (first && !first.includes('-Tổng')) {
                setUndoStack(us => [...us.slice(-19), dataByMonth[month] || {}]);
                setEditingCell(first);
                setEditValue(e.key);
             }
         }
      }
    };
    const handleMouseUp = () => setIsSelecting(false);

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedCells, currentWeight, ALL_CELL_KEYS, VISIBLE_GRID_KEYS, getCellValue]);

  // Scroll shadow handler
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollLeft > 2);
    }
  }, []);

  // Removed summary from here to place below grandTotal

  // Get channel color — uses channel-specific color first, falls back to category
  const getChannelColor = (ch: Channel): string => {
    return ch.color;
  };

  // Inline style constants for sticky cells — prevents CSS cache issues
  const stickyHeaderCol1: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 50,
    background: '#eef2f7',
    width: COL1_WIDTH,
    minWidth: COL1_WIDTH,
    borderRight: '2px solid #cbd5e1',
    borderTop: '3px solid var(--color-brand)',
  };

  const stickyHeaderCol2: React.CSSProperties = {
    position: 'sticky',
    left: COL1_WIDTH,
    zIndex: 50,
    background: '#eef2f7',
    width: COL2_WIDTH,
    minWidth: COL2_WIDTH,
    borderRight: '2px solid #cbd5e1',
    borderTop: '3px solid var(--color-brand)',
  };

  const stickyBodyCol1: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 30,
    background: '#ffffff',
    width: COL1_WIDTH,
    minWidth: COL1_WIDTH,
    borderRight: '2px solid #cbd5e1',
    fontWeight: 700,
    color: 'var(--color-brand)',
  };

  const stickyBodyCol2: React.CSSProperties = {
    position: 'sticky',
    left: COL1_WIDTH,
    zIndex: 30,
    background: '#ffffff',
    width: COL2_WIDTH,
    minWidth: COL2_WIDTH,
    borderRight: '2px solid #cbd5e1',
  };

  const brandSubtotals = useMemo(() => {
    const subtotals: Record<string, any> = {};
    const filteredBrandsForTotal = brands.filter(b => selectedBrand === 'all' || b.name === selectedBrand);

    for (const brand of filteredBrandsForTotal) {
      let budget = 0, khqt = 0, gdtd = 0, khd = 0;
      let histBudget = 0, histKhqt = 0, histGdtd = 0, histKhd = 0;
      const channelTotals: Record<string, Record<string, number>> = {};
      const histChannelTotals: Record<string, Record<string, number>> = {};

      const filteredModels = brand.models.filter(m => selectedModels.length === 0 || selectedModels.includes(m));

      for (const ch of CHANNELS) {
        channelTotals[ch.name] = { 'Ngân sách': 0, 'KHQT': 0, 'GDTD': 0, 'KHĐ': 0 };
        histChannelTotals[ch.name] = { 'Ngân sách': 0, 'KHQT': 0, 'GDTD': 0, 'KHĐ': 0 };
        for (const model of filteredModels) {
          const isAgg = brand.modelData?.find((x: any) => x.name === model)?.is_aggregate;
          if (isAgg) continue; // Prevent double counting
          for (const metric of METRICS) {
            const cellKey = `${brand.name}-${model}-${ch.name}-${metric}`;
            const val = getUnroundedCellValue(cellKey);
            const histVal = getHistoricalValue(cellKey, compareMode);
            
            channelTotals[ch.name][metric] += val;
            if (histVal !== null) histChannelTotals[ch.name][metric] += histVal;
            if (ch.name !== 'Tổng Digital') {
              if (metric === 'Ngân sách') { budget += val; if (histVal !== null) histBudget += histVal; }
              if (metric === 'KHQT') { khqt += val; if (histVal !== null) histKhqt += histVal; }
              if (metric === 'GDTD') { gdtd += val; if (histVal !== null) histGdtd += histVal; }
              if (metric === 'KHĐ') { khd += val; if (histVal !== null) histKhd += histVal; }
            }
          }
        }
      }

      // Round aggregated values
      for (const ch in channelTotals) {
        for (const m in channelTotals[ch]) {
          channelTotals[ch][m] = m === 'Ngân sách' ? Math.round(channelTotals[ch][m] * 10) / 10 : Math.round(channelTotals[ch][m]);
        }
      }
      for (const ch in histChannelTotals) {
        for (const m in histChannelTotals[ch]) {
          histChannelTotals[ch][m] = m === 'Ngân sách' ? Math.round(histChannelTotals[ch][m] * 10) / 10 : Math.round(histChannelTotals[ch][m]);
        }
      }
      budget = Math.round(budget * 10) / 10;
      histBudget = Math.round(histBudget * 10) / 10;
      khqt = Math.round(khqt);
      histKhqt = Math.round(histKhqt);
      gdtd = Math.round(gdtd);
      histGdtd = Math.round(histGdtd);
      khd = Math.round(khd);
      histKhd = Math.round(histKhd);

      subtotals[brand.name] = { budget, khqt, gdtd, khd, histBudget, histKhqt, histGdtd, histKhd, channelTotals, histChannelTotals };
    }
    return subtotals;
  }, [cellData, compareMode, getHistoricalValue, selectedBrand, selectedModels, getUnroundedCellValue]);

  // Compute grand total
  const grandTotal = useMemo(() => {
    let budget = 0, khqt = 0, gdtd = 0, khd = 0;
    let histBudget = 0, histKhqt = 0, histGdtd = 0, histKhd = 0;
    const channelTotals: Record<string, Record<string, number>> = {};
    const histChannelTotals: Record<string, Record<string, number>> = {};

    for (const ch of CHANNELS) {
      channelTotals[ch.name] = { 'Ngân sách': 0, 'KHQT': 0, 'GDTD': 0, 'KHĐ': 0 };
      histChannelTotals[ch.name] = { 'Ngân sách': 0, 'KHQT': 0, 'GDTD': 0, 'KHĐ': 0 };
    }

    const filteredBrandsForTotal = brands.filter(b => selectedBrand === 'all' || b.name === selectedBrand);

    for (const brand of filteredBrandsForTotal) {
      const filteredModels = brand.models.filter(m => selectedModels.length === 0 || selectedModels.includes(m));
      for (const model of filteredModels) {
        const isAgg = brand.modelData?.find((x: any) => x.name === model)?.is_aggregate;
        if (isAgg) continue; // Prevent double counting in Grand Total as well
        for (const ch of CHANNELS) {
          for (const metric of METRICS) {
            const cellKey = `${brand.name}-${model}-${ch.name}-${metric}`;
            const val = getUnroundedCellValue(cellKey);
            const histVal = getHistoricalValue(cellKey, compareMode);
            
            channelTotals[ch.name][metric] += val;
            if (histVal !== null) histChannelTotals[ch.name][metric] += histVal;
            if (ch.name !== 'Tổng Digital') {
              if (metric === 'Ngân sách') { budget += val; if (histVal !== null) histBudget += histVal; }
              if (metric === 'KHQT') { khqt += val; if (histVal !== null) histKhqt += histVal; }
              if (metric === 'GDTD') { gdtd += val; if (histVal !== null) histGdtd += histVal; }
              if (metric === 'KHĐ') { khd += val; if (histVal !== null) histKhd += histVal; }
            }
          }
        }
      }
    }

    // Round aggregated values
    for (const ch in channelTotals) {
      for (const m in channelTotals[ch]) {
        channelTotals[ch][m] = m === 'Ngân sách' ? Math.round(channelTotals[ch][m] * 10) / 10 : Math.round(channelTotals[ch][m]);
      }
    }
    for (const ch in histChannelTotals) {
      for (const m in histChannelTotals[ch]) {
        histChannelTotals[ch][m] = m === 'Ngân sách' ? Math.round(histChannelTotals[ch][m] * 10) / 10 : Math.round(histChannelTotals[ch][m]);
      }
    }
    budget = Math.round(budget * 10) / 10;
    histBudget = Math.round(histBudget * 10) / 10;
    khqt = Math.round(khqt);
    histKhqt = Math.round(histKhqt);
    gdtd = Math.round(gdtd);
    histGdtd = Math.round(histGdtd);
    khd = Math.round(khd);
    histKhd = Math.round(histKhd);

    return { budget, khqt, gdtd, khd, histBudget, histKhqt, histGdtd, histKhd, channelTotals, histChannelTotals };
  }, [cellData, compareMode, getHistoricalValue, selectedBrand, selectedModels, getUnroundedCellValue]);

  const summary = useMemo(() => {
    return {
      budget: grandTotal.budget,
      khqt: grandTotal.khqt,
      gdtd: grandTotal.gdtd,
      khd: grandTotal.khd,
      cpl: grandTotal.khqt > 0 ? Math.round(grandTotal.budget / grandTotal.khqt * 10) / 10 : 0
    };
  }, [grandTotal]);

  // Per-showroom direct event totals (for PHÂN BỔ SHOWROOM — Sự kiện channel)
  const showroomEventTotals = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const sr of SHOWROOMS) {
      result[sr] = { 'Ngân sách': 0, 'KHQT': 0, 'GDTD': 0, 'KHĐ': 0 };
      for (const ev of events) {
        let mult: number;
        if (ev.showroom === 'all' || ev.showroom === 'Tất cả') {
          mult = SR_WEIGHTS[sr] || 0;
        } else if (ev.showroom === sr) {
          mult = 1;
        } else {
          continue;
        }
        result[sr]['Ngân sách'] += (ev.budget || 0) * mult;
        result[sr]['KHQT']      += (ev.leads  || 0) * mult;
        result[sr]['GDTD']      += (ev.gdtd   || 0) * mult;
        result[sr]['KHĐ']       += (ev.deals  || 0) * mult;
      }
      // Round
      for (const m of Object.keys(result[sr])) {
        result[sr][m] = m === 'Ngân sách' ? Math.round(result[sr][m] * 10) / 10 : Math.round(result[sr][m]);
      }
    }
    return result;
  }, [events]);

  const hasTier2 = useMemo(() => {
    return visibleChannels.some(ch => visibleChannels.filter(c => c.category === ch.category).length > 1);
  }, [visibleChannels]);

  const handleExecuteAllocation = () => {
    if (!allocationModal) return;
    const actionEl = document.getElementById('alloc-action') as HTMLSelectElement;
    const valEl = document.getElementById('alloc-budget') as HTMLInputElement;
    const baseEl = document.getElementById('alloc-base') as HTMLSelectElement;
    const val = (allocationModal.type === 'channel' || allocationModal.type === 'category') ? massPercent : (parseFloat(valEl?.value) || 0);
    
    let baseMonth = month;
    if (baseEl && baseEl.value !== 'current') baseMonth = parseInt(baseEl.value, 10);
    const baseData = dataByMonth[baseMonth] || {};

    const autoCalculateMetrics = (cName: string, newBudget: number, nextObj: CellData, baseKey: string, baseData: CellData) => {
      const oldBudget = baseData[`${baseKey}-Ngân sách`] || 0;
      if (oldBudget > 0) {
        // Tôn trọng tỷ lệ CPL lịch sử nếu base có data
        const ratio = newBudget / oldBudget;
        nextObj[`${baseKey}-KHQT`] = Math.round((baseData[`${baseKey}-KHQT`] || 0) * ratio);
        nextObj[`${baseKey}-GDTD`] = Math.round((baseData[`${baseKey}-GDTD`] || 0) * ratio);
        nextObj[`${baseKey}-KHĐ`]  = Math.round((baseData[`${baseKey}-KHĐ`] || 0) * ratio);
      } else {
        // Nếu không có lịch sử, dùng CPL tiêu chuẩn
        const cpl = cName === 'Facebook' ? 0.08 : cName === 'Google' ? 0.12 : cName === 'Sự kiện' ? 0.3 : 0.15;
        const khqt = Math.round(newBudget / cpl);
        const cr1 = (cName === 'Sự kiện') ? 0.3 : 0.15;
        const gdtd = Math.round(khqt * cr1);
        const khd = Math.round(gdtd * (cName === 'CSKH' ? 0.5 : 0.25));
        
        nextObj[`${baseKey}-KHQT`] = khqt;
        nextObj[`${baseKey}-GDTD`] = gdtd;
        nextObj[`${baseKey}-KHĐ`]  = khd;
      }
    };

    if (allocationModal.type === 'brand') {
      const channelEl = document.getElementById('alloc-channel') as HTMLSelectElement;
      const action = actionEl.value; // 'even' | 'weight'
      const targetChannel = channelEl.value; // 'all' | channel name
      const budget = val;
      if (budget <= 0) { setAlertInfo({ type: 'warning', title: 'Thông báo', message: 'Vui lòng nhập ngân sách hợp lệ (>0).' }); return; }

      setCellData(prev => {
        const next = {...prev};
        const brand = DEMO_BRANDS.find(b => b.name === allocationModal.name);
        if (!brand) return next;

        const models = brand.models;
        const channelsToUpdate = CHANNELS.filter(c => c.name !== 'Tổng Digital' && (targetChannel === 'all' || c.name === targetChannel));
        
        if (action === 'even') {
          const budgetPerModel = budget / models.length;
          const budgetPerChannel = budgetPerModel / channelsToUpdate.length;
          models.forEach(m => {
            channelsToUpdate.forEach(c => {
              const baseKey = `${brand.name}-${m}-${c.name}`;
              const key = `${baseKey}-Ngân sách`;
              const finalVal = Math.round(budgetPerChannel * 10) / 10;
              next[key] = finalVal;
              autoCalculateMetrics(c.name, finalVal, next, baseKey, baseData);
            });
          });
        } else if (action === 'weight') {
          let currentTotal = 0;
          const currentMap = new Map();
          models.forEach(m => {
            channelsToUpdate.forEach(c => {
              const key = `${brand.name}-${m}-${c.name}-Ngân sách`;
              const cv = baseData[key] || 0; // Luôn đo tỷ trọng bằng baseData!
              currentMap.set(key, cv);
              currentTotal += cv;
            });
          });
          if (currentTotal === 0) { 
            setAlertInfo({ type: 'warning', title: 'Không thể chia theo tỷ trọng', message: `Tỷ trọng của tháng cơ sở (T${baseMonth}) đang là 0. Hệ thống không có cơ sở để chia đều. Vui lòng chọn Phương thức: Cào bằng.`}); 
            return prev; 
          }
          models.forEach(m => {
            channelsToUpdate.forEach(c => {
              const baseKey = `${brand.name}-${m}-${c.name}`;
              const key = `${baseKey}-Ngân sách`;
              const cv = currentMap.get(key) || 0;
              const ratio = cv / currentTotal;
              const finalVal = Math.round((budget * ratio) * 10) / 10;
              next[key] = finalVal;
              autoCalculateMetrics(c.name, finalVal, next, baseKey, baseData);
            });
          });
        }
        return next;
      });
    } else if (allocationModal.type === 'channel' || allocationModal.type === 'category') {
      const percent = val;
      if (percent === 0) { setAlertInfo({ type: 'warning', title: 'Lỗi', message: 'Vui lòng nhập mức % khác 0!' }); return; }
      setCellData(prev => {
        const next = {...prev};
        
        let channelsToUpdate: string[] = [];
        if (allocationModal.type === 'category') {
           channelsToUpdate = CHANNELS.filter(c => c.category === allocationModal.name && c.name !== 'Tổng Digital').map(c => c.name);
        } else {
           channelsToUpdate = allocationModal.name === 'Tổng Digital' 
            ? digitalChannelNames 
            : [allocationModal.name];
        }

        DEMO_BRANDS.forEach(b => {
          b.models.forEach(m => {
            channelsToUpdate.forEach(chName => {
              const baseKey = `${b.name}-${m}-${chName}`;
              const key = `${baseKey}-Ngân sách`;
              const baseVal = baseData[key] || 0;
              if (baseVal > 0) {
                const adj = baseVal * (1 + percent / 100);
                const finalVal = Math.round(adj * 10) / 10;
                next[key] = finalVal;
                autoCalculateMetrics(chName, finalVal, next, baseKey, baseData);
              }
            });
          });
        });
        return next;
      });
    }
    setAllocationModal(null);
  };

// ─── Actual mode: ghost plan value + delta helpers ──────────────────────────
  const getActualDelta = useCallback((cellKey: string, actualVal: number): number | null => {
    if (pageMode !== 'actual') return null;
    const planVal = planCellData[cellKey] || 0;
    if (planVal === 0) return actualVal > 0 ? 100 : null;
    return Math.round(((actualVal - planVal) / planVal) * 100);
  }, [pageMode, planCellData]);

  // Render actual mode cell: actual value + ghost plan + delta
  const renderActualCell = useCallback((cellKey: string, val: number, isEditing: boolean) => {
    const ghost = planCellData[cellKey] || 0;
    const delta = getActualDelta(cellKey, val);
    const isBudget = cellKey.endsWith('-Ngân sách');
    // budget: tăng = xấu (đỏ); KPI: tăng = tốt (xanh)
    const deltaColor = delta === null ? 'transparent'
      : delta === 0 ? 'var(--color-text-muted)'
      : (isBudget ? (delta > 0 ? '#dc2626' : '#059669') : (delta > 0 ? '#059669' : '#dc2626'));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '100%', justifyContent: 'center', lineHeight: 1.2, gap: 1, opacity: isEditing ? 0 : 1 }}>
        <span style={{ color: val > 0 ? 'var(--color-text)' : 'transparent', fontWeight: val > 0 ? 600 : 400 }}>
          {val > 0 ? formatNumber(val) : ''}
        </span>
        {ghost > 0 && (
          <span style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 2 }}>
            {formatNumber(ghost)}
            {delta !== null && (
              <span style={{ color: deltaColor, fontWeight: 700 }}>
                {delta > 0 ? `▲${delta}%` : delta < 0 ? `▼${Math.abs(delta)}%` : '—'}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }, [planCellData, getActualDelta]);

// FilterDropdown — using top-level definition (L215) to avoid shadow/duplicate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader
        year={year}
        month={month}
        viewMode={viewMode}
        onPeriodChange={(y, m) => { setYear(y); setMonth(m); }}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setCompareMode('none');
        }}
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="button-erp-secondary" style={{ padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4 }} title="Import Excel">
              <UploadCloud size={14} /> <span style={{ fontSize: 12 }}>Import</span>
            </button>
            <button className="button-erp-secondary" style={{ padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4 }} title="Export Excel">
              <DownloadCloud size={14} /> <span style={{ fontSize: 12 }}>Export</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }}></div>
            {pageMode === 'plan' ? (
              <>
                <button
                  className="button-erp-secondary"
                  style={{ color: 'var(--color-brand)', fontWeight: 600, padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setConfirmInfo({ type: 'save', title: 'Xác nhận Lưu nháp', message: 'Bạn có muốn lưu lại bản nháp hiện tại của kế hoạch ngân sách?' })}
                >
                  <Save size={13} />
                  <span style={{ fontSize: 12 }}>Lưu nháp</span>
                </button>
                <button
                  className="button-erp-primary"
                  style={{ padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4, background: approvalStatus !== 'draft' ? 'var(--color-text-muted)' : undefined, borderColor: approvalStatus !== 'draft' ? 'var(--color-text-muted)' : undefined }}
                  onClick={() => {
                    if (approvalStatus !== 'draft') {
                        setAlertInfo({ type: 'info', title: 'Thông báo', message: `Kế hoạch đang ở trạng thái: ${approvalStatus === 'pending' ? 'Chờ duyệt' : 'Đã duyệt'}` });
                    } else if (budgetCap > 0 && summary.budget > budgetCap) {
                        setAlertInfo({ type: 'warning', title: 'Vượt giới hạn ngân sách', message: `Tổng ngân sách kế hoạch (${formatNumber(summary.budget)} tr) đã vượt giới hạn cho phép (${formatNumber(budgetCap)} tr). Vui lòng điều chỉnh trước khi gửi duyệt.` });
                    } else {
                        setConfirmInfo({ type: 'submit', title: 'Xác nhận Gửi duyệt', message: 'Sau khi gửi duyệt, bạn sẽ không thể chỉnh sửa kế hoạch này cho đến khi có phản hồi từ Quản lý. Bạn có chắc chắn?' });
                    }
                  }}
                >
                  <Send size={13} />
                  <span style={{ fontSize: 12 }}>{approvalStatus === 'draft' ? 'Gửi duyệt' : (approvalStatus === 'pending' ? 'Đã gửi duyệt' : 'Hoàn tất')}</span>
                </button>
              </>
            ) : (
              <>
                {/* Actual mode: Lưu TH + Nộp TH */}
                {(actualStatusByMonth[month] || 'draft') !== 'submitted' && (
                  <button
                    className="button-erp-secondary"
                    style={{ padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4, opacity: isDirtyActual ? 1 : 0.6 }}
                    onClick={handleSaveActual}
                    title="Lưu nháp thực hiện"
                  >
                    <Save size={13} />
                    <span style={{ fontSize: 12 }}>Lưu TH</span>
                  </button>
                )}
                <button
                  className="button-erp-primary"
                  style={{
                    padding: '2px 12px', height: 26, display: 'flex', alignItems: 'center', gap: 4,
                    background: (actualStatusByMonth[month] || 'draft') === 'submitted' ? '#6b7280' : '#059669',
                    borderColor: (actualStatusByMonth[month] || 'draft') === 'submitted' ? '#6b7280' : '#059669',
                    cursor: (actualStatusByMonth[month] || 'draft') === 'submitted' ? 'default' : 'pointer',
                  }}
                  onClick={() => {
                    if ((actualStatusByMonth[month] || 'draft') === 'submitted') return;
                    setConfirmInfo({ type: 'submit-actual' as never, title: 'Xác nhận Nộp số thực hiện', message: `Sau khi nộp, số thực hiện tháng ${month}/${year} sẽ được chốt và không thể chỉnh sửa. Bạn có chắc chắn?` });
                  }}
                  title={(actualStatusByMonth[month] || 'draft') === 'submitted' ? 'Đã nộp số thực hiện' : 'Nộp xác nhận số thực hiện'}
                >
                  <CloudUpload size={13} />
                  <span style={{ fontSize: 12 }}>{(actualStatusByMonth[month] || 'draft') === 'submitted' ? 'Đã chốt' : 'Nộp TH'}</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Amber accent strip khi actual mode */}
      {pageMode === 'actual' && (
        <div style={{
          height: 3, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
          flexShrink: 0,
        }} />
      )}

      {/* ROW 3: Mode Switcher | Entity Selection — Đơn vị | Thương hiệu | Dòng xe | So sánh */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 12px', height: 34, minHeight: 34,
        borderBottom: '1px solid var(--color-border)',
        background: pageMode === 'actual' ? '#fffbeb' : 'var(--color-surface)',
        flexShrink: 0, flexWrap: 'nowrap',
      }}>
        {/* ── Mode Switcher KẾ HOẠCH / THỰC HIỆN ── */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', marginRight: 8 }}>
          <button
            onClick={() => { setPageMode('plan'); setCompareMode('none'); }}
            style={{
              padding: '0 12px', height: 24, fontSize: 11, fontWeight: pageMode === 'plan' ? 700 : 500,
              background: pageMode === 'plan' ? 'var(--color-primary)' : '#fff',
              color: pageMode === 'plan' ? '#fff' : 'var(--color-text-secondary)',
              borderTop: `1px solid ${pageMode === 'plan' ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
              borderBottom: `1px solid ${pageMode === 'plan' ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
              borderLeft: `1px solid ${pageMode === 'plan' ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
              borderRight: 'none', borderRadius: '5px 0 0 5px',
              cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.02em',
            }}
          >KẾ HOẠCH</button>
          <button
            onClick={() => { setPageMode('actual'); setCompareMode('none'); }}
            style={{
              padding: '0 12px', height: 24, fontSize: 11, fontWeight: pageMode === 'actual' ? 700 : 500,
              background: pageMode === 'actual' ? '#f59e0b' : '#fff',
              color: pageMode === 'actual' ? '#fff' : 'var(--color-text-secondary)',
              borderTop: `1px solid ${pageMode === 'actual' ? '#f59e0b' : 'var(--color-border-dark)'}`,
              borderBottom: `1px solid ${pageMode === 'actual' ? '#f59e0b' : 'var(--color-border-dark)'}`,
              borderLeft: `1px solid ${pageMode === 'actual' ? '#f59e0b' : 'var(--color-border-dark)'}`,
              borderRight: `1px solid ${pageMode === 'actual' ? '#f59e0b' : 'var(--color-border-dark)'}`,
              borderRadius: '0 5px 5px 0',
              cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.02em',
            }}
          >THỰC HIỆN</button>
        </div>

        {/* Status badge actual mode */}
        {pageMode === 'actual' && (
          <Badge
            variant={(actualStatusByMonth[month] || 'draft') === 'submitted' ? 'success-light' : isDirtyActual ? 'warning-light' : 'secondary'}
            size="sm"
            style={{ letterSpacing: '0.04em', fontWeight: 700, marginRight: 8 }}
          >
            {(actualStatusByMonth[month] || 'draft') === 'submitted' ? '✓ Đã chốt' : isDirtyActual ? '● Chưa lưu' : '○ Nháp'}
          </Badge>
        )}

        <div className="toolbar-sep" style={{ height: 14, margin: '0 8px' }} />
        {/* Nhóm 1: Đơn vị */}
        <FilterDropdown
          label="Đơn vị"
          value={selectedShowroom}
          options={[{value: 'all', label: '— Tất cả SR —'}, ...SHOWROOMS.map(sr => ({value: sr, label: sr}))]}
          onChange={setSelectedShowroom}
          width={140}
          placeholder="— Tất cả SR —"
        />
        <div className="toolbar-sep" style={{ height: 14, margin: '0 10px' }} />
        {/* Nhóm 2: Thương hiệu */}
        <FilterDropdown
          label="Thương hiệu"
          value={selectedBrand}
          options={[{value: 'all', label: '— Tất cả —'}, ...DEMO_BRANDS.map(b => ({value: b.name, label: b.name}))]}
          onChange={(val: string) => { setSelectedBrand(val); setSelectedModels([]); }}
          width={120}
        />
        <div className="toolbar-sep" style={{ height: 14, margin: '0 10px' }} />
        {/* Nhóm 3: Dòng xe */}
        <FilterDropdown
          label="Dòng xe"
          value={selectedModels}
          options={availableModels.map(m => ({value: m, label: m}))}
          onChange={setSelectedModels}
          width={130}
          isMulti={true}
          placeholder="— Tất cả —"
        />
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        {/* Nhóm 4: So sánh — đẩy sang phải */}
        <FilterDropdown
          label="So sánh"
          value={compareMode}
          options={pageMode === 'actual' ? [
            { value: 'none', label: '— Không so sánh —' },
            { value: 'vs_plan', label: `So với KH T${month}/${year} (% đạt)` },
            ...(viewMode === 'month' ? [
              { value: 'prev_actual', label: `TH tháng trước (T${month === 1 ? 12 : month - 1}/${month === 1 ? year - 1 : year})` },
            ] : viewMode === 'quarter' ? [
              { value: 'prev_actual', label: `TH quý trước (Q${Math.ceil(month/3) === 1 ? 4 : Math.ceil(month/3) - 1}/${Math.ceil(month/3) === 1 ? year - 1 : year})` },
            ] : [])
          ] : [
            { value: 'none', label: '— Không so sánh —' },
            ...(viewMode === 'month' ? [
              { value: 'prev_period', label: `Tháng trước (T${month === 1 ? 12 : month - 1}/${month === 1 ? year - 1 : year})` },
              { value: 'prev_year', label: `Cùng kỳ năm trước (T${month}/${year - 1})` }
            ] : viewMode === 'quarter' ? [
              { value: 'prev_period', label: `Quý trước (Q${Math.ceil(month/3) === 1 ? 4 : Math.ceil(month/3) - 1})` },
              { value: 'prev_year', label: `Cùng kỳ năm trước` }
            ] : [
              { value: 'prev_period', label: `Năm trước (${year - 1})` }
            ])
          ]}
          onChange={setCompareMode}
          width={110}
          placeholder="— Không so sánh —"
        />
      </div>

      {/* ROW 4: Kênh | Metric toggles | Ẩn dòng trống */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid var(--color-border)', background: pageMode === 'actual' ? '#fffbeb' : 'var(--color-surface)', flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {/* Kênh chips */}
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Kênh:</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
            <button
              onClick={() => toggleHiddenChannel('DIGITAL')}
              style={{
                padding: '2px 8px', fontSize: 11, fontWeight: 600,
                border: '1px solid', borderRadius: 4,
                borderColor: hiddenChannels.has('DIGITAL') ? '#cbd5e1' : '#EA4335',
                background: hiddenChannels.has('DIGITAL') ? 'transparent' : '#EA433515',
                color: hiddenChannels.has('DIGITAL') ? 'var(--color-text-muted)' : '#EA4335',
                cursor: 'pointer', textDecoration: hiddenChannels.has('DIGITAL') ? 'line-through' : 'none',
              }}
            >
              Digital
            </button>
            {!hiddenChannels.has('DIGITAL') && (
              <button
                onClick={() => setDigitalCollapsed(c => !c)}
                style={{ padding: '2px 7px', fontSize: 10, border: '1px solid #EA433540', borderRadius: 4, background: digitalCollapsed ? '#EA433520' : 'transparent', color: '#EA4335', cursor: 'pointer' }}
                title={digitalCollapsed ? 'Mở rộng kênh Digital' : 'Thu gọn kênh Digital'}
              >
                {digitalCollapsed ? '⊞ Mở' : '⊟ Thu'}
              </button>
            )}
            {[{ cat: 'SỰ KIỆN', label: 'Sự kiện', color: '#10B981' }, { cat: 'CSKH', label: 'CSKH', color: '#F59E0B' }, { cat: 'NHẬN DIỆN', label: 'Nhận diện', color: '#8B5CF6' }].map(({ cat, label, color }) => (
              <button
                key={cat}
                onClick={() => toggleHiddenChannel(cat)}
                style={{
                  padding: '2px 8px', fontSize: 10, fontWeight: 600,
                  border: '1px solid', borderRadius: 4,
                  borderColor: hiddenChannels.has(cat) ? '#cbd5e1' : color,
                  background: hiddenChannels.has(cat) ? 'transparent' : `${color}15`,
                  color: hiddenChannels.has(cat) ? 'var(--color-text-muted)' : color,
                  cursor: 'pointer', textDecoration: hiddenChannels.has(cat) ? 'line-through' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="toolbar-sep" style={{ height: 14, flexShrink: 0 }} />

          {/* Chỉ số toggle buttons */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', flexShrink: 0 }}>
            {METRICS.map(metric => {
              const isHidden = hiddenMetrics.has(metric);
              const labelMap: Record<string, string> = { 'Ngân sách': 'NS', 'KHQT': 'KHQT', 'GDTD': 'GDTD', 'KHĐ': 'KHĐ' };
              return (
                <button
                  key={metric}
                  title={metric}
                  onClick={() => setHiddenMetrics(prev => { const next = new Set(prev); if (next.has(metric)) next.delete(metric); else next.add(metric); return next; })}
                  style={{
                    padding: '2px 8px', fontSize: 11, fontWeight: !isHidden ? 700 : 400,
                    border: '1px solid', borderRadius: 4, width: 44, textAlign: 'center',
                    borderColor: !isHidden ? 'var(--color-brand)' : 'var(--color-border)',
                    background: !isHidden ? 'var(--color-brand)' : 'transparent',
                    color: !isHidden ? '#fff' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    textDecoration: isHidden ? 'line-through' : 'none'
                  }}
                >
                  {labelMap[metric] || metric}
                </button>
              );
            })}
          </div>

          <div className="toolbar-sep" style={{ height: 14, flexShrink: 0 }} />

          {/* Ẩn dòng trống */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: hideZeroRows ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', fontWeight: hideZeroRows ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={hideZeroRows}
              onChange={e => setHideZeroRows(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--color-brand)', cursor: 'pointer' }}
            />
            Ẩn dòng trống
          </label>

        </div>

        {/* ROW 4: Quick Summary Strip — KPIs căn phải */}
        <div className="summary-strip" style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="summary-chip">
              <Wallet size={12} style={{ color: 'var(--color-brand)', opacity: 0.7 }} />
              <span className="summary-chip-label">Tổng NS</span>
              <span className="summary-chip-value" style={{ color: 'var(--color-brand)' }}>
                {summary.budget > 0 ? formatNumber(summary.budget) : '—'} <span className="summary-chip-unit">tr</span>
              </span>
            </div>
            <div className="summary-divider" style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
            <div className="summary-chip">
              <Users size={12} style={{ color: '#3B82F6', opacity: 0.7 }} />
              <span className="summary-chip-label">KHQT</span>
              <span className="summary-chip-value" style={{ color: '#3B82F6' }}>
                {summary.khqt > 0 ? formatNumber(summary.khqt) : '—'}
              </span>
            </div>
            <div className="summary-divider" style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
            <div className="summary-chip">
              <BarChart3 size={12} style={{ color: '#F59E0B', opacity: 0.7 }} />
              <span className="summary-chip-label">GDTD</span>
              <span className="summary-chip-value" style={{ color: '#F59E0B' }}>
                {summary.gdtd > 0 ? formatNumber(summary.gdtd) : '—'}
              </span>
            </div>
            <div className="summary-divider" style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
            <div className="summary-chip">
              <FileSignature size={12} style={{ color: '#10B981', opacity: 0.7 }} />
              <span className="summary-chip-label">KHĐ</span>
              <span className="summary-chip-value" style={{ color: '#10B981' }}>
                {summary.khd > 0 ? formatNumber(summary.khd) : '—'}
              </span>
            </div>
            <div className="summary-divider" style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
            <div className="summary-chip">
              <span className="summary-chip-label">CPL</span>
              <span className="summary-chip-value" style={{ color: summary.cpl !== null ? '#8B5CF6' : 'var(--color-text-muted)' }}>
                {summary.cpl !== null ? summary.cpl.toFixed(1) : '—'} <span className="summary-chip-unit">tr/lead</span>
              </span>
            </div>

            {/* Sprint 4: Budget Cap */}
            <div className="summary-divider" style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
            <div className="summary-chip" style={{ gap: 5 }}>
              <span className="summary-chip-label">Giới hạn NS</span>
              {editingCap ? (
                <input
                  type="number"
                  value={capInput}
                  autoFocus
                  onChange={e => setCapInput(e.target.value)}
                  onBlur={() => {
                    const v = parseFloat(capInput) || 0;
                    saveBudgetCap(v);
                    setEditingCap(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      const v = e.key === 'Enter' ? (parseFloat(capInput) || 0) : budgetCap;
                      saveBudgetCap(v);
                      setEditingCap(false);
                    }
                  }}
                  style={{ width: 60, height: 20, fontSize: 11, padding: '0 4px', border: '1px solid var(--color-brand)', borderRadius: 2, textAlign: 'right' }}
                />
              ) : (
                <span
                  className="summary-chip-value"
                  title="Click để đặt giới hạn ngân sách"
                  onClick={() => { setCapInput(budgetCap > 0 ? String(budgetCap) : ''); setEditingCap(true); }}
                  style={{
                    color: budgetCap > 0
                      ? (summary.budget > budgetCap ? '#dc2626' : summary.budget > budgetCap * 0.9 ? '#d97706' : '#059669')
                      : 'var(--color-text-muted)',
                    cursor: 'pointer', textDecoration: 'underline dotted',
                  }}
                >
                  {budgetCap > 0 ? (
                    <>
                      {formatNumber(summary.budget)}/{formatNumber(budgetCap)}
                      <span className="summary-chip-unit"> tr</span>
                      {summary.budget > budgetCap && (
                        <span style={{ marginLeft: 4, color: '#dc2626', fontWeight: 700 }}>VUOT!</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Chua dat</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Spreadsheet Data Grid */}
        <div
          ref={scrollRef}
          className={cn("table-scroll-container", isScrolled && "scrolled")}
          onScroll={handleScroll}
        >
          <table className="data-table">
            <thead>
              {/* Tier 1: Category Group Headers */}
              <tr style={{ height: 28 }}>
                <th rowSpan={hasTier2 ? (isActualSplitMode ? 4 : 3) : (isActualSplitMode ? 3 : 2)} style={{ ...stickyHeaderCol1, top: 0 }}>
                  Thương hiệu
                </th>
                <th rowSpan={hasTier2 ? (isActualSplitMode ? 4 : 3) : (isActualSplitMode ? 3 : 2)} style={{ ...stickyHeaderCol2, top: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span>Dòng xe</span>
                    <span 
                      onClick={() => {
                        if (collapsedBrands.size === DEMO_BRANDS.length) {
                          setCollapsedBrands(new Set());
                        } else {
                          setCollapsedBrands(new Set(DEMO_BRANDS.map(b => b.name)));
                        }
                      }}
                      style={{ cursor: 'pointer', color: 'var(--color-brand)', fontSize: 10, fontWeight: 700, padding: '2px 4px', background: '#eef2f7', borderRadius: 4 }}
                      title={collapsedBrands.size === DEMO_BRANDS.length ? 'Mở rộng tất cả dòng xe' : 'Thu gọn tất cả dòng xe'}
                    >
                      {collapsedBrands.size === DEMO_BRANDS.length ? '⊞ Mở' : '⊟ Thu'}
                    </span>
                  </div>
                </th>
                {(() => {
                  const renderedCategories = new Set<string>();
                  return visibleChannels.map((ch) => {
                    // Only render each category once
                    if (renderedCategories.has(ch.category)) return null;
                    renderedCategories.add(ch.category);

                    const catColor = CATEGORY_COLOR_MAP[ch.category] || ch.color;

                    // Count number of visible channels in this category
                    let visibleChannelsInCat = visibleChannels.filter(c => c.category === ch.category);
                    if (ch.category === 'DIGITAL') {
                      if (digitalCollapsed) {
                        visibleChannelsInCat = visibleChannelsInCat.filter(c => c.name === 'Tổng Digital');
                      }
                    }
                    
                    const metricMultiplier = isActualSplitMode ? 2 : 1;
                    const colSpanCount = visibleChannelsInCat.length * visibleMetrics.length * metricMultiplier;
                    const rowSpanCount = (hasTier2 && visibleChannelsInCat.length === 1) ? 2 : 1;

                    return (
                      <th
                        key={`group-${ch.category}`}
                        colSpan={colSpanCount}
                        rowSpan={rowSpanCount}
                        style={{
                          position: 'sticky', top: 0, zIndex: 20,
                          textAlign: 'center',
                          background: `color-mix(in srgb, ${catColor} 10%, #f8fafc)`,
                          borderBottom: '1px solid #cbd5e1',
                          borderTop: `3px solid ${catColor}`,
                          padding: '4px 8px'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                          {ch.category}
                          <span 
                            onClick={() => {
                               if (pageMode === 'actual') return; // allocation chỉ dùng trong plan mode
                               if (isDataLocked) {
                                 setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu đang bị khóa chỉnh sửa.' });
                               } else {
                                 setAllocationModal({ open: true, type: 'category', name: ch.category });
                               }
                            }}
                            style={{ cursor: pageMode === 'actual' ? 'default' : 'pointer', opacity: pageMode === 'actual' ? 0.3 : 0.7, padding: '2px', marginLeft: 2 }}
                            title={pageMode === 'actual' ? 'Phân bổ chỉ dùng trong KẾ HOẠCH' : 'Thao tác nhanh cho nhóm kênh này'}
                          >
                            <Zap size={11} style={{ verticalAlign: 'text-bottom', color: catColor }} />
                          </span>
                          {ch.category === 'DIGITAL' && (
                            <span 
                              onClick={() => setDigitalCollapsed(c => !c)}
                              style={{ fontSize: 10, color: catColor, fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}
                              title={digitalCollapsed ? 'Mở rộng kênh Digital' : 'Thu gọn kênh Digital'}
                            >
                              {digitalCollapsed ? '[⊕ Mở]' : '[⊟ Thu]'}
                            </span>
                          )}
                        </span>
                      </th>
                    );
                  });
                })()}
                <th
                  colSpan={4}
                  rowSpan={hasTier2 ? 2 : 1}
                  style={{
                    position: 'sticky', top: 0, zIndex: 20,
                    background: '#e8f4fd',
                    color: 'var(--color-brand)',
                    textAlign: 'center',
                    fontWeight: 700,
                    borderTop: '3px solid var(--color-brand)',
                    borderBottom: '1px solid #cbd5e1'
                  }}
                >
                  TỔNG CỘNG
                </th>
              </tr>

              {/* Tier 2: Specific Channel Headers */}
              {hasTier2 && (
                <tr style={{ height: 28 }}>
                  {visibleChannels.map((ch) => {
                  const channelsInCat = visibleChannels.filter(c => c.category === ch.category);
                  if (channelsInCat.length === 1) return null;

                  const color = getChannelColor(ch);
                  return (
                    <th
                      key={`channel-${ch.name}`}
                      colSpan={visibleMetrics.length * (isActualSplitMode ? 2 : 1)}
                      style={{
                        position: 'sticky', top: 28, zIndex: 20,
                        textAlign: 'center',
                        background: `color-mix(in srgb, ${color} 10%, #f8fafc)`,
                        borderBottom: '1px solid #cbd5e1',
                        color: ch.name === 'Tổng Digital' ? 'var(--color-brand)' : color,
                        fontSize: 'var(--fs-label)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '4px 8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span>{ch.name}</span>
                        {ch.name !== 'Tổng Digital' && (
                          <span 
                            onClick={() => {
                               if (pageMode === 'actual') return; // allocation chỉ dùng trong plan mode
                               if (isDataLocked) {
                                 setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu đang bị khóa chỉnh sửa.' });
                               } else {
                                 setAllocationModal({ open: true, type: 'channel', name: ch.name });
                               }
                            }}
                            style={{ cursor: pageMode === 'actual' ? 'default' : 'pointer', opacity: pageMode === 'actual' ? 0.3 : 0.7, padding: '2px', display: 'flex' }}
                            title={pageMode === 'actual' ? 'Phân bổ chỉ dùng trong KẾ HOẠCH' : 'Tăng/giảm ngân sách hàng loạt cho kênh này'}
                          >
                            <Zap size={11} />
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            )}

              {/* Tier 3: Metric sub-headers */}
              <tr style={{ height: 28 }}>
                {visibleChannels.map((ch) => {
                  const color = getChannelColor(ch);
                  return visibleMetrics.map((metric) => (
                    <th
                      key={`${ch.name}-${metric}`}
                      colSpan={isActualSplitMode ? 2 : 1}
                      style={{
                        position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 20,
                        background: `color-mix(in srgb, ${color} 10%, #f8fafc)`,
                        width: isActualSplitMode ? 80 : 72, minWidth: isActualSplitMode ? 80 : 72,
                        textAlign: 'center',
                        fontSize: 'var(--fs-label)',
                        borderBottom: isActualSplitMode ? 'none' : '1px solid #cbd5e1',
                        padding: '4px 8px'
                      }}
                    >
                      {metric === 'Ngân sách' ? 'NS' : metric}
                    </th>
                  ));
                })}
                <th style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 20, width: 80, minWidth: 80, background: '#e8f4fd', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #cbd5e1', padding: '4px 8px' }}>Ngân sách</th>
                <th style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 20, width: 60, minWidth: 60, background: '#e8f4fd', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #cbd5e1', padding: '4px 8px' }}>KHQT</th>
                <th style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 20, width: 60, minWidth: 60, background: '#e8f4fd', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #cbd5e1', padding: '4px 8px' }}>GDTD</th>
                <th style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 20, width: 60, minWidth: 60, background: '#e8f4fd', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #cbd5e1', padding: '4px 8px' }}>KHĐ</th>
              </tr>

              {/* Tier 4 (actual split mode only): KH | TH sub-headers per metric */}
              {isActualSplitMode && (
                <tr style={{ height: 22 }}>
                  {visibleChannels.map((ch) => {
                    const color = getChannelColor(ch);
                    return visibleMetrics.map((metric) => (
                      <React.Fragment key={`${ch.name}-${metric}-split`}>
                        <th style={{
                          position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 20,
                          background: `color-mix(in srgb, ${color} 8%, #f0f4f8)`,
                          width: 40, minWidth: 40, maxWidth: 40,
                          textAlign: 'center', fontSize: 9, fontWeight: 600,
                          color: '#64748b', letterSpacing: '0.04em',
                          borderBottom: '2px solid #cbd5e1',
                          borderRight: '1px dashed #e2e8f0',
                          padding: '2px 4px'
                        }}>
                          KH
                        </th>
                        <th style={{
                          position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 20,
                          background: `color-mix(in srgb, #f59e0b 8%, #fffbeb)`,
                          width: 40, minWidth: 40, maxWidth: 40,
                          textAlign: 'center', fontSize: 9, fontWeight: 700,
                          color: '#d97706', letterSpacing: '0.04em',
                          borderBottom: '2px solid #fde68a',
                          padding: '2px 4px'
                        }}>
                          TH
                        </th>
                      </React.Fragment>
                    ));
                  })}
                  {/* TỔNG CỘNG: không split */}
                  <th colSpan={4} style={{ position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 20, background: '#e8f4fd', borderBottom: '2px solid #cbd5e1' }} />
                </tr>
              )}
            </thead>
            <tbody>
              {DEMO_BRANDS.filter(b => selectedBrand === 'all' || b.name === selectedBrand).map((brand) => {
                const subtotal = brandSubtotals[brand.name] || { budget: 0, khqt: 0, gdtd: 0, khd: 0, histBudget: 0, histKhqt: 0, histGdtd: 0, histKhd: 0, channelTotals: {}, histChannelTotals: {} };
                const isCollapsed = collapsedBrands.has(brand.name);

                const sortedModels = [...brand.models];

                // Apply hideZeroRows filter and selectedModels filter
                const filteredBySelection = sortedModels.filter(model => selectedModels.length === 0 || selectedModels.includes(model));
                const displayModels = hideZeroRows
                  ? filteredBySelection.filter(model =>
                      CHANNELS.some(ch => ch.name !== 'Tổng Digital' && METRICS.some(m => getCellValue(`${brand.name}-${model}-${ch.name}-${m}`) > 0))
                    )
                  : filteredBySelection;
                return (
                  <React.Fragment key={brand.name}>
                    {/* Model rows — hidden when brand is collapsed */}
                    {!isCollapsed && displayModels.map((model, modelIdx) => {
                      let totalBudget = 0, histTotalBudget = 0;
                      let totalKhqt = 0, histTotalKhqt = 0;
                      let totalGdtd = 0, histTotalGdtd = 0;
                      let totalKhd = 0, histTotalKhd = 0;

                      const isComputedRow = brand.modelData?.find((x: any) => x.name === model)?.is_aggregate || false;

                      return (
                        <tr key={`${brand.name}-${model}`}>
                          {modelIdx === 0 && (
                            <td
                              style={stickyBodyCol1}
                              rowSpan={displayModels.length}
                              onClick={() => toggleBrand(brand.name)}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
                                <span style={{ fontSize: 8, color: 'var(--color-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: 'rotate(0deg)' }}>▼</span>
                                {brand.name}
                              </span>
                            </td>
                          )}
                          <td style={{ ...stickyBodyCol2, fontWeight: isComputedRow ? 700 : '500', background: isComputedRow ? '#f0f4f8' : '#ffffff', color: isComputedRow ? 'var(--color-brand)' : 'inherit', textTransform: isComputedRow ? 'uppercase' : 'none' }}>
                            {model}
                          </td>
                          {visibleChannels.map((ch) =>
                            visibleMetrics.map((metric) => {
                              const cellKey = `${brand.name}-${model}-${ch.name}-${metric}`;
                              const val = getCellValue(cellKey);
                              const histVal = getHistoricalValue(cellKey, compareMode);
                              const cellNote = (notesByMonth[month] || {})[cellKey];
                              
                              let isHighCpl = false;
                              if (metric === 'Ngân sách' && val > 0) {
                                  const localKhqt = getCellValue(`${brand.name}-${model}-${ch.name}-KHQT`);
                                  if (localKhqt > 0 && (val / localKhqt) > 0.5) isHighCpl = true;
                              }
                              
                              if (ch.name !== 'Tổng Digital') {
                                if (metric === 'Ngân sách') {
                                  totalBudget += val;
                                  if (histVal !== null) histTotalBudget += histVal;
                                }
                                if (metric === 'KHQT') {
                                  totalKhqt += val;
                                  if (histVal !== null) histTotalKhqt += histVal;
                                }
                                if (metric === 'GDTD') {
                                  totalGdtd += val;
                                  if (histVal !== null) histTotalGdtd += histVal;
                                }
                                if (metric === 'KHĐ') {
                                  totalKhd += val;
                                  if (histVal !== null) histTotalKhd += histVal;
                                }
                              }

                              // ── ACTUAL SPLIT MODE: Tháng chưa chốt → 2 cột KH | TH ──
                              if (isActualSplitMode && !ch.readonly && !isComputedRow && !cellKey.includes('-Tổng Digital-')) {
                                const planVal = planCellData[cellKey] || 0;
                                const actualVal = (actualDataByMonth[month] || {})[cellKey] || 0;
                                const isIntField = cellKey.endsWith('-KHQT') || cellKey.endsWith('-GDTD') || cellKey.endsWith('-KHĐ');
                                return (
                                  <React.Fragment key={cellKey}>
                                    {/* KH — Plan value: read-only reference */}
                                    <td style={{ padding: 0, borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px dashed #cbd5e1', height: 26, background: '#f8fafc' }}>
                                      <div style={{ padding: '2px 6px', textAlign: 'right', fontSize: 'var(--fs-table)', color: '#94a3b8', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {planVal > 0 ? formatNumber(planVal) : ''}
                                      </div>
                                    </td>
                                    {/* TH — Actual value: inline editable */}
                                    <td style={{ padding: 0, borderTop: '1px solid #fde68a', borderBottom: '1px solid #fde68a', borderLeft: 'none', borderRight: '1px solid #fde68a', height: 26, background: actualVal > 0 ? '#fffbeb' : '#ffffff' }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={actualVal > 0 ? String(actualVal) : ''}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          if (raw === '') {
                                            setCellData(prev => { const n = {...prev}; delete n[cellKey]; return n; });
                                          } else {
                                            const num = parseFloat(raw);
                                            if (!isNaN(num)) {
                                              if (isIntField && !Number.isInteger(num)) return;
                                              setCellData(prev => ({ ...prev, [cellKey]: num }));
                                            }
                                          }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        style={{
                                          width: '100%', height: '100%', border: 'none', background: 'transparent',
                                          textAlign: 'right', fontSize: 'var(--fs-table)', padding: '2px 6px',
                                          outline: 'none',
                                          color: actualVal > 0 ? '#92400e' : '#d1d5db',
                                          fontWeight: actualVal > 0 ? 600 : 400,
                                        }}
                                        placeholder="—"
                                      />
                                    </td>
                                  </React.Fragment>
                                );
                              }

                              return (
                                <td key={cellKey} style={{ padding: 0, border: '1px solid #e2e8f0', height: compareMode !== 'none' ? 44 : 26 }}>
                                  <div
                                    className={cn(
                                      "cell-wrapper",
                                      editingCell === cellKey ? "cell-editing" : "cell-idle"
                                    )}
                                    onBlur={(e) => {
                                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                          handleCellBlur();
                                      }
                                    }}
                                    onMouseDown={(e) => {
                                         if (e.button !== 0) return;
                                         if (ch.readonly || isComputedRow) return;
                                         if (cellKey.includes('-Tổng Digital-') || isComputedRow) return;
                                         setIsSelecting(true);
                                         setSelectionStartIdx(ALL_CELL_KEYS.indexOf(cellKey));
                                         setSelectedCells(new Set([cellKey]));
                                         if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                                      }}
                                      onMouseEnter={() => {
                                         if (!isSelecting) return;
                                         const currentIdx = ALL_CELL_KEYS.indexOf(cellKey);
                                         let startR = -1; let startC = -1; let curR = -1; let curC = -1;
                                         const startKey = ALL_CELL_KEYS[selectionStartIdx];
                                         if (!startKey) return;
                                         for(let r=0; r<VISIBLE_GRID_KEYS.length; r++) {
                                             for(let c=0; c<VISIBLE_GRID_KEYS[r].length; c++) {
                                                 if (VISIBLE_GRID_KEYS[r][c] === startKey) { startR = r; startC = c; }
                                                 if (VISIBLE_GRID_KEYS[r][c] === cellKey) { curR = r; curC = c; }
                                             }
                                         }
                                         if (startR !== -1 && curR !== -1) {
                                             const minR = Math.min(startR, curR);
                                             const maxR = Math.max(startR, curR);
                                             const minC = Math.min(startC, curC);
                                             const maxC = Math.max(startC, curC);
                                             const newSel = new Set<string>();
                                             for (let r = minR; r <= maxR; r++) {
                                                  for (let c = minC; c <= maxC; c++) {
                                                       const k = VISIBLE_GRID_KEYS[r][c];
                                                       if (k && !k.includes('-Tổng')) newSel.add(k);
                                                  }
                                             }
                                             setSelectedCells(newSel);
                                         }
                                      }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setEditingNoteCell(cellKey);
                                      setEditingCell(null);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      if (isDataLocked) {
                                        setAlertInfo({ type: 'warning', title: 'Không hợp lệ', message: 'Dữ liệu đang bị khoá chỉnh sửa.' });
                                        return;
                                      }
                                      if (ch.readonly || isComputedRow) return;
                                      if (cellKey.includes('-Tổng Digital-') || isComputedRow) return;
                                      setUndoStack(us => [...us.slice(-19), cellData]); // Bug fix: dùng cellData (mode-aware) thay vì dataByMonth
                                      setEditingCell(cellKey);
                                      setEditValue(currentWeight === 1 ? String(val || '') : String((val * currentWeight).toFixed(2)));
                                      setEditingNoteCell(null);
                                    }}
                                     style={(() => {
                                        const isOverBudget = pageMode === 'actual' && cellKey.endsWith('-Ngân sách') && val > 0 && (planCellData[cellKey] || 0) > 0 && val > (planCellData[cellKey] || 0) * 1.1;
                                        return {
                                          height: '100%', position: 'relative' as const,
                                          background: isOverBudget ? '#fff5f5' : ((ch.readonly || isComputedRow) ? '#f0f4f8' : (isHighCpl ? '#fef08a' : (selectedCells.has(cellKey) ? '#e0f2fe' : 'transparent'))),
                                          boxShadow: isOverBudget ? 'inset 0 0 0 1.5px #ef4444' : (selectedCells.has(cellKey) ? 'inset 0 0 0 1.5px var(--color-brand)' : 'none'),
                                          cursor: (ch.readonly || isComputedRow) ? 'default' : (selectedCells.has(cellKey) ? 'cell' : 'text'),
                                          fontWeight: isComputedRow ? 600 : 'normal',
                                          color: isComputedRow ? 'var(--color-brand)' : 'inherit',
                                        };
                                      })()}
                                  >
                                    {isHighCpl && (
                                      <div className="group" style={{ position: 'absolute', top: 2, right: 2, color: '#eab308', zIndex: 20, cursor: 'help' }}>
                                        <AlertTriangle size={10} />
                                        <div 
                                          className="hidden group-hover:block" 
                                          style={{ 
                                            position: 'absolute', top: 16, right: 0, 
                                            backgroundColor: '#1e293b', color: '#fff', 
                                            padding: '4px 8px', borderRadius: 4, fontSize: 11,
                                            width: 'max-content', maxWidth: 200, zIndex: 300,
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                          }}
                                        >
                                          Cảnh báo: CPL đang quá cao (&gt;500k/Leads)
                                        </div>
                                      </div>
                                    )}
                                    {cellNote && !isHighCpl && (
                                      <div className="group" style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, cursor: 'help', zIndex: 20 }}>
                                        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 8px 8px 0', borderColor: 'transparent #ef4444 transparent transparent' }} />
                                        <div 
                                          className="hidden group-hover:block" 
                                          style={{ 
                                            position: 'absolute', top: 16, right: 0, 
                                            backgroundColor: '#1e293b', color: '#fff', 
                                            padding: '4px 8px', borderRadius: 4, fontSize: 11,
                                            width: 'max-content', maxWidth: 200, wordWrap: 'break-word', whiteSpace: 'pre-wrap',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', zIndex: 300 
                                          }}
                                        >
                                          {cellNote}
                                          {(!editingCell && !editingNoteCell) && (
                                             <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>(Chuột phải để sửa)</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {editingNoteCell === cellKey && (
                                      <CellNoteEditor 
                                        initialValue={cellNote || ''}
                                        onSave={(newVal) => {
                                          setNotesByMonth(prev => ({ ...prev, [month]: { ...(prev[month] || {}), [cellKey]: newVal } }));
                                          setEditingNoteCell(null);
                                        }}
                                        onCancel={() => setEditingNoteCell(null)}
                                        onDelete={() => {
                                          setNotesByMonth(prev => {
                                            const newMonth = { ...(prev[month] || {}) };
                                            delete newMonth[cellKey];
                                            return { ...prev, [month]: newMonth };
                                          });
                                          setEditingNoteCell(null);
                                        }}
                                      />
                                    )}
                                    
                                    {editingCell === cellKey && (
                                        <input
                                          type="text"
                                          autoFocus
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={() => {
                                            if (editValue.trim() !== '') {
                                              handleCellChange(cellKey, editValue);
                                            }
                                            setEditingCell(null);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              // Khi enter hoàn tất quá trình lưu để goalseek chạy
                                              if (editValue.trim() !== '') {
                                                handleCellChange(cellKey, editValue);
                                              }
                                              setEditingCell(null);
                                            }
                                            if (e.key === 'Escape') {
                                              setEditingCell(null);
                                            }
                                            // Cho phép các mũi tên navigate
                                            e.stopPropagation();
                                          }}
                                          className="cell-input"
                                          style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#fff' }}
                                        />
                                    )}
                                    {pageMode === 'actual' && editingCell !== cellKey
                                      ? renderActualCell(cellKey, val, false)
                                      : renderDualValue(val, histVal, editingCell === cellKey)}
                                  </div>
                                </td>
                              );
                            })
                          )}
                          {/* Row totals */}
                          <td style={{ textAlign: 'right', fontWeight: 700, background: isComputedRow ? '#e2e8f0' : '#e8f4fd', color: 'var(--color-brand)' }}>
                            {renderDualValue(totalBudget, compareMode !== 'none' ? histTotalBudget : null, false)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: isComputedRow ? 700 : 600, background: isComputedRow ? '#e2e8f0' : '#f0f9ff', color: isComputedRow ? 'var(--color-brand)' : 'inherit' }}>
                            {renderDualValue(totalKhqt, compareMode !== 'none' ? histTotalKhqt : null, false)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: isComputedRow ? 700 : 600, background: isComputedRow ? '#e2e8f0' : '#f0f9ff', color: isComputedRow ? 'var(--color-brand)' : 'inherit' }}>
                            {renderDualValue(totalGdtd, compareMode !== 'none' ? histTotalGdtd : null, false)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: isComputedRow ? 700 : 600, background: isComputedRow ? '#e2e8f0' : '#f0f9ff', color: isComputedRow ? 'var(--color-brand)' : 'inherit' }}>
                            {renderDualValue(totalKhd, compareMode !== 'none' ? histTotalKhd : null, false)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Brand Subtotal Row — always visible, click to toggle */}
                    <tr className="subtotal">
                      <td
                        style={{ ...stickyBodyCol1, background: isCollapsed ? '#e8f0fb' : '#f0f4f8', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggleBrand(brand.name)}
                        title={isCollapsed ? `Mở rộng ${brand.name}` : `Thu gọn ${brand.name}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            fontSize: 8,
                            color: 'var(--color-brand)',
                            display: 'inline-block',
                            transition: 'transform 0.2s',
                            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          }}>▼</span>
                          {brand.name}
                        </span>
                      </td>
                      <td style={{ ...stickyBodyCol2, background: isCollapsed ? '#e8f0fb' : '#f0f4f8', fontWeight: 700, fontSize: 'var(--fs-table)', color: 'var(--color-text)' }}>
                        Σ {brand.name}
                      </td>
                      {visibleChannels.map((ch) =>
                        visibleMetrics.map((metric) => (
                          <td
                            key={`sub-${brand.name}-${ch.name}-${metric}`}
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              background: isCollapsed ? '#e8f0fb' : '#f0f4f8',
                              color: 'var(--color-text-secondary)',
                              fontSize: 'var(--fs-table)',
                            }}
                          >
                            {renderDualValue(
                              subtotal.channelTotals[ch.name]?.[metric] ?? 0,
                              compareMode !== 'none' ? (subtotal.histChannelTotals[ch.name]?.[metric] ?? 0) : null,
                              false
                            )}
                          </td>
                        ))
                      )}
                      <td style={{ textAlign: 'right', fontWeight: 700, background: '#dbeafe', color: 'var(--color-brand)' }}>
                        {renderDualValue(subtotal.budget, compareMode !== 'none' ? subtotal.histBudget : null, false)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, background: '#e0f2fe' }}>
                        {renderDualValue(subtotal.khqt, compareMode !== 'none' ? subtotal.histKhqt : null, false)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, background: '#e0f2fe' }}>
                        {renderDualValue(subtotal.gdtd, compareMode !== 'none' ? subtotal.histGdtd : null, false)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, background: '#e0f2fe' }}>
                        {renderDualValue(subtotal.khd, compareMode !== 'none' ? subtotal.histKhd : null, false)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Grand Total Row */}
              <tr className="grand-total">
                <td style={{ ...stickyBodyCol1, background: '#f0f9ff', fontWeight: 800, color: 'var(--color-brand)', borderTop: '2px solid var(--color-brand)' }}>
                  TỔNG
                </td>
                <td style={{ ...stickyBodyCol2, background: '#f0f9ff', fontWeight: 700, borderTop: '2px solid var(--color-brand)', color: 'var(--color-brand)' }}>
                  TOÀN BỘ
                </td>
                {visibleChannels.map((ch) =>
                  visibleMetrics.map((metric) => (
                    <td
                      key={`grand-${ch.name}-${metric}`}
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: 'var(--fs-table)',
                        background: ch.readonly ? '#f0f4f8' : undefined,
                      }}
                    >
                      {renderDualValue(
                        grandTotal.channelTotals[ch.name]?.[metric] ?? 0,
                        compareMode !== 'none' ? (grandTotal.histChannelTotals[ch.name]?.[metric] ?? 0) : null,
                        false
                      )}
                    </td>
                  ))
                )}
                <td style={{ textAlign: 'right', fontWeight: 800, background: '#dbeafe', color: 'var(--color-brand)', fontSize: 12 }}>
                  {renderDualValue(grandTotal.budget, compareMode !== 'none' ? grandTotal.histBudget : null, false)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, background: '#e0f2fe', color: 'var(--color-brand)' }}>
                  {renderDualValue(grandTotal.khqt, compareMode !== 'none' ? grandTotal.histKhqt : null, false)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, background: '#e0f2fe', color: 'var(--color-brand)' }}>
                  {renderDualValue(grandTotal.gdtd, compareMode !== 'none' ? grandTotal.histGdtd : null, false)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, background: '#e0f2fe', color: 'var(--color-brand)' }}>
                  {renderDualValue(grandTotal.khd, compareMode !== 'none' ? grandTotal.histKhd : null, false)}
                </td>
              </tr>

              {/* TỔNG HỢP THEO SHOWROOM */}
              <tr>
                <td colSpan={2} style={{ ...stickyBodyCol1, background: '#f1f5f9', fontWeight: 800, padding: '10px 8px', borderTop: '4px solid #cbd5e1', color: 'var(--color-text-secondary)', fontSize: 11, letterSpacing: '0.04em' }}>
                  PHÂN BỔ SHOWROOM
                </td>
                <td colSpan={visibleChannels.length * visibleMetrics.length + 4} style={{ background: '#f1f5f9', borderTop: '4px solid #cbd5e1' }}></td>
              </tr>

              {(selectedShowroom === 'all' ? SHOWROOMS : SHOWROOMS.filter(s => s === selectedShowroom || s.toLowerCase().includes(selectedShowroom))).map((sr) => {
                const weight = SR_WEIGHTS[sr] || 0.05;
                const getGlobal = (v: number) => currentWeight > 0 ? v / currentWeight : v;
                return (
                  <tr key={`sr-${sr}`}>
                    <td colSpan={2} style={{ ...stickyBodyCol1, background: '#ffffff', fontWeight: 600, color: 'var(--color-text)' }}>
                      {sr} <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>({(weight * 100).toFixed(0)}%)</span>
                    </td>
                    {visibleChannels.map((ch) =>
                      visibleMetrics.map((metric) => {
                        const totalVal = grandTotal.channelTotals[ch.name]?.[metric] ?? 0;
                        const histTotalVal = grandTotal.histChannelTotals[ch.name]?.[metric] ?? 0;
                        const isBudget = metric === 'Ngân sách' || metric === 'CPL';
                        const getWeighted = (v: number) => isBudget ? Math.round(getGlobal(v) * weight * 10) / 10 : Math.round(getGlobal(v) * weight);
                        const displayVal = ch.name === 'Sự kiện'
                          ? (showroomEventTotals[sr]?.[metric] ?? 0)
                          : getWeighted(totalVal);
                        const displayHistVal = ch.name === 'Sự kiện'
                          ? null
                          : (compareMode !== 'none' ? getWeighted(histTotalVal) : null);
                        return (
                          <td
                            key={`sr-${sr}-${ch.name}-${metric}`}
                            style={{
                              textAlign: 'right',
                              fontSize: 'var(--fs-table)',
                              background: ch.readonly ? '#f8fafc' : undefined,
                            }}
                          >
                            {renderDualValue(
                              displayVal,
                              displayHistVal,
                              false
                            )}
                          </td>
                        );
                      })
                    )}
                    {(() => {
                      // grandTotal.budget includes event budgets spread globally (applyMultiplier=1 when selectedShowroom='all').
                      // We must remove the global event contribution and add back the SR-specific event totals.
                      const globalEvBudget = grandTotal.channelTotals['Sự kiện']?.['Ngân sách'] ?? 0;
                      const globalEvKhqt   = grandTotal.channelTotals['Sự kiện']?.['KHQT']     ?? 0;
                      const globalEvGdtd   = grandTotal.channelTotals['Sự kiện']?.['GDTD']     ?? 0;
                      const globalEvKhd    = grandTotal.channelTotals['Sự kiện']?.['KHĐ']      ?? 0;
                      const srEvBudget = showroomEventTotals[sr]?.['Ngân sách'] ?? 0;
                      const srEvKhqt   = showroomEventTotals[sr]?.['KHQT']     ?? 0;
                      const srEvGdtd   = showroomEventTotals[sr]?.['GDTD']     ?? 0;
                      const srEvKhd    = showroomEventTotals[sr]?.['KHĐ']      ?? 0;
                      const srBudget = Math.round((getGlobal(grandTotal.budget - globalEvBudget) * weight + srEvBudget) * 10) / 10;
                      const srKhqt   = Math.round(getGlobal(grandTotal.khqt - globalEvKhqt) * weight + srEvKhqt);
                      const srGdtd   = Math.round(getGlobal(grandTotal.gdtd - globalEvGdtd) * weight + srEvGdtd);
                      const srKhd    = Math.round(getGlobal(grandTotal.khd  - globalEvKhd)  * weight + srEvKhd);
                      const srHistBudget = compareMode !== 'none' ? Math.round(getGlobal(grandTotal.histBudget) * weight * 10) / 10 : null;
                      const srHistKhqt   = compareMode !== 'none' ? Math.round(getGlobal(grandTotal.histKhqt) * weight) : null;
                      const srHistGdtd   = compareMode !== 'none' ? Math.round(getGlobal(grandTotal.histGdtd) * weight) : null;
                      const srHistKhd    = compareMode !== 'none' ? Math.round(getGlobal(grandTotal.histKhd)  * weight) : null;
                      return (<>
                        <td style={{ textAlign: 'right', fontWeight: 700, background: '#f0f9ff', color: 'var(--color-brand)' }}>
                          {renderDualValue(srBudget, srHistBudget, false)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, background: '#f8fafc' }}>
                          {renderDualValue(srKhqt, srHistKhqt, false)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, background: '#f8fafc' }}>
                          {renderDualValue(srGdtd, srHistGdtd, false)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, background: '#f8fafc' }}>
                          {renderDualValue(srKhd, srHistKhd, false)}
                        </td>
                      </>);
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* CHI TIẾT TỔ CHỨC SỰ KIỆN TRONG THÁNG */}
          <div style={{ marginTop: 24, borderTop: '2px solid var(--color-border-dark)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={16} />
                Kế hoạch tổ chức sự kiện trong tháng
              </h3>
              
              <div style={{ display: 'flex', gap: 8 }}>
                {approvalStatus === 'draft' && (
                  <button 
                    className="button-erp-primary" 
                    style={{ height: 26, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: selectedShowroom === 'all' ? 0.5 : 1, cursor: selectedShowroom === 'all' ? 'not-allowed' : 'pointer' }}
                    disabled={selectedShowroom === 'all'}
                    title={selectedShowroom === 'all' ? 'Vui lòng chọn đơn vị để thêm sự kiện' : 'Thêm sự kiện mới'}
                    onClick={() => {
                      if (selectedShowroom === 'all') return;
                      setEventModal({
                        open: true,
                        isNew: true,
                        data: {
                          id: Date.now(),
                          showroom: selectedShowroom,
                          name: '',
                          type: 'Sự kiện KH',
                          date: '',
                          location: '',
                          brands: [],
                          budget: 0
                        }
                      });
                    }}
                  >
                    <span style={{ fontSize: 14 }}>+</span> Thêm sự kiện
                  </button>
                )}
              </div>
            </div>
            
            <table className="erp-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', height: 32 }}>
                  {selectedShowroom === 'all' && (
                    <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'left', width: 150, color: 'var(--color-text-muted)', fontWeight: 600 }}>Chi nhánh / Đơn vị</th>
                  )}
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'left', width: 200, color: 'var(--color-text-muted)', fontWeight: 600 }}>Tên chiến dịch / Sự kiện</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center', width: 100, color: 'var(--color-text-muted)', fontWeight: 600 }}>Loại hình</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center', width: 90, color: 'var(--color-text-muted)', fontWeight: 600 }}>Thời gian</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'left', width: 150, color: 'var(--color-text-muted)', fontWeight: 600 }}>Địa điểm dự kiến</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'left', width: 130, color: 'var(--color-text-muted)', fontWeight: 600 }}>Thương hiệu</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>Dòng xe áp dụng</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', width: 90, color: 'var(--color-text-muted)', fontWeight: 600 }}>NS <span style={{ fontSize: 10, fontWeight: 400 }}>(Triệu đ)</span></th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', width: 60, color: 'var(--color-text-muted)', fontWeight: 600 }}>KHQT</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', width: 60, color: 'var(--color-text-muted)', fontWeight: 600 }}>Lái thử</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', width: 60, color: 'var(--color-text-muted)', fontWeight: 600 }}>GDTD</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', width: 60, color: 'var(--color-text-muted)', fontWeight: 600 }}>KHĐ</th>
                  <th style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center', width: 80, color: 'var(--color-text-muted)', fontWeight: 600 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Lọc sự kiện: Bao gồm sự kiện của Showroom + sự kiện Tất cả SR (Global)
                  const filteredEvents = selectedShowroom === 'all' 
                    ? events 
                    : events.filter(ev => ev.showroom === selectedShowroom || ev.showroom === 'all' || ev.showroom === 'Tất cả');

                  const getMultiplier = (ev: EventItem) => {
                    if (selectedShowroom === 'all') return 1;
                    if (ev.showroom === selectedShowroom) return 1;
                    if (ev.showroom === 'all' || ev.showroom === 'Tất cả') return SR_WEIGHTS[selectedShowroom] || 0;
                    return 0;
                  };

                  if (!eventsLoaded) return (
                    <tr>
                      <td colSpan={selectedShowroom === 'all' ? 13 : 12} style={{ border: '1px solid var(--color-border)', padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Đang tải dữ liệu sự kiện...
                      </td>
                    </tr>
                  );

                  if (filteredEvents.length === 0) return (
                    <tr>
                      <td colSpan={selectedShowroom === 'all' ? 13 : 12} style={{ border: '1px solid var(--color-border)', padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Chưa có sự kiện nào được lên kế hoạch trong tháng này{selectedShowroom !== 'all' ? ` tại ${selectedShowroom}` : ''}.
                      </td>
                    </tr>
                  );

                  const eventScopeFactors: Record<string, number> = {};
                  for (const ev of filteredEvents) {
                    if (selectedBrand === 'all' && selectedModels.length === 0) {
                      eventScopeFactors[ev.id] = 1; continue;
                    }
                    const touchedBrands = brands.filter(db => 
                      ev.brands.includes(db.name) || db.models.some(m => ev.brands.includes(m))
                    );
                    const isGlobalEvent = touchedBrands.length === 0;
                    const numBrands = isGlobalEvent ? brands.length : touchedBrands.length;
                    if (numBrands === 0) { eventScopeFactors[ev.id] = 1; continue; }
                    
                    let f = 0;
                    const visibleBrands = brands.filter(b => selectedBrand === 'all' || b.name === selectedBrand);
                    for (const b of visibleBrands) {
                      if (!isGlobalEvent && !touchedBrands.find(tb => tb.name === b.name)) continue;
                      const allBrandModels = b.models.filter((m: string) => {
                        const mObj = b.modelData?.find((x: { name: string; is_aggregate?: boolean }) => x.name === m);
                        return !mObj?.is_aggregate;
                      });
                      const selectedModelsForBrand = allBrandModels.filter((m: string) => ev.brands.includes(m));
                      const targetModels = selectedModelsForBrand.length > 0 ? selectedModelsForBrand : allBrandModels;
                      const visibleModels = targetModels.filter(m => selectedModels.length === 0 || selectedModels.includes(m));
                      f += (1 / numBrands) * (1 / targetModels.length) * visibleModels.length;
                    }
                    eventScopeFactors[ev.id] = f;
                  }

                  const totalBudget = filteredEvents.reduce((s, ev) => s + (ev.budget * getMultiplier(ev) * (eventScopeFactors[ev.id] || 1)), 0);
                  const totalDerived = filteredEvents.reduce((acc, ev) => {
                    const d = getEventDerived(ev);
                    const m = getMultiplier(ev) * (eventScopeFactors[ev.id] || 1);
                    return { 
                      khqt: acc.khqt + (d.khqt * m), 
                      gdtd: acc.gdtd + (d.gdtd * m), 
                      khd: acc.khd + (d.khd * m), 
                      testDrives: acc.testDrives + (d.testDrives * m) 
                    };
                  }, { khqt: 0, gdtd: 0, khd: 0, testDrives: 0 });

                  return (<>
                  {filteredEvents.map((ev) => {
                    const baseM = getMultiplier(ev);
                    const scopeF = eventScopeFactors[ev.id] || 1;
                    const m = baseM * scopeF;
                    const isAllocated = m < 1;
                    return (
                    <tr key={ev.id} style={{ height: 36, background: (baseM < 1) ? '#fafafa' : '#fff' }}>
                          {selectedShowroom === 'all' && (
                            <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', color: 'var(--color-text-muted)' }}>{ev.showroom}</td>
                          )}
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', fontWeight: 500 }}>
                            {ev.name}
                            {isAllocated && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 4px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4, letterSpacing: '-0.3px', display: 'inline-block' }} title={`Sự kiện phân bổ: ${baseM < 1 ? `Chi nhánh (${(baseM*100).toFixed(0)}%) ` : ''}${scopeF < 1 ? `Ngữ cảnh lọc (${(scopeF*100).toFixed(0)}%)` : ''}`}>[Phân bổ {(m * 100).toFixed(0)}%]</span>
                            )}
                          </td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{ev.type}</span>
                          </td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center', color: 'var(--color-text)', fontSize: 11, fontWeight: 500 }}>{ev.date || '—'}</td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', color: 'var(--color-text-muted)' }}>{ev.location || '—'}</td>
                          {/* Cột Thương hiệu */}
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ev.brands
                                .filter((b: string) => DEMO_BRANDS.some(db => db.name === b))
                                .map((b: string) => (
                                  <span key={b} style={{ fontSize: 10, padding: '1px 6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, color: '#1d4ed8', fontWeight: 600 }}>{b}</span>
                                ))}
                            </div>
                          </td>
                          {/* Cột Dòng xe */}
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ev.brands
                                .filter((b: string) => !DEMO_BRANDS.some(db => db.name === b))
                                .map((b: string) => (
                                  <span key={b} style={{ fontSize: 10, padding: '1px 6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, color: '#475569' }}>{b}</span>
                                ))}
                              {ev.brands.filter((b: string) => !DEMO_BRANDS.some(db => db.name === b)).length === 0 && (
                                <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>Tất cả dòng xe</span>
                              )}
                            </div>
                          </td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-brand)' }}>{formatNumber(ev.budget * m)}</td>
                          {(() => { const d = getEventDerived(ev); return (<>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{formatNumber(d.khqt * m)}</td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 600, color: '#06b6d4' }}>{formatNumber(d.testDrives * m)}</td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>{formatNumber(d.gdtd * m)}</td>
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatNumber(d.khd * m)}</td>
                          </>); })()}
                          <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                              {baseM < 1 ? (
                                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Read-only</span>
                              ) : (
                                <>
                                  <button onClick={() => setEventModal({ open: true, isNew: false, data: {...ev} })} style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Chỉnh sửa">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => {
                                    setConfirmInfo({ type: 'delete', title: `Xóa sự kiện "${ev.name}"?`, message: `Ngân sách ${formatNumber(ev.budget)} triệu sẽ bị loại bỏ khỏi kế hoạch. Hành động này không thể hoàn tác.` });
                                    // Store delete handler in a ref-like approach via the confirm callback
                                    const originalConfirmHandler = async () => {
                                      const success = await deleteEventFromDB(ev.id);
                                      if (success) {
                                        setEvents(prev => prev.filter(e => e.id !== ev.id));
                                        setConfirmInfo(null);
                                        setAlertInfo({ type: 'success', title: 'Đã xóa', message: `Sự kiện "${ev.name}" đã được xóa thành công.` });
                                      } else {
                                        setAlertInfo({ type: 'warning', title: 'Lỗi', message: `Không thể xóa sự kiện "${ev.name}". Vui lòng thử lại.` });
                                        setConfirmInfo(null);
                                      }
                                    };
                                    // Override confirm handler via state
                                    setPendingDeleteFn(() => originalConfirmHandler);
                                  }} style={{ color: 'var(--color-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Xóa">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                              <div style={{ width: 1, background: '#e2e8f0', margin: '0 2px' }}></div>
                              <button onClick={() => setAlertInfo({ type: 'info', title: 'Tính năng đang phát triển', message: 'Chức năng Nghiệm thu sự kiện sẽ được triển khai trong phiên bản tiếp theo.' })} style={{ color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Nghiệm thu sự kiện (Sắp ra mắt)">
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                          </td>
                    </tr>
                    );
                  })}
                  {/* Event Total Row */}
                  <tr style={{ height: 32, background: '#f0f9ff', borderTop: '2px solid var(--color-brand)' }}>
                    {selectedShowroom === 'all' && <td style={{ border: '1px solid var(--color-border)', padding: '0 8px' }}></td>}
                    <td colSpan={6} style={{ border: '1px solid var(--color-border)', padding: '0 8px', fontWeight: 700, color: 'var(--color-brand)' }}>Σ Tổng ({filteredEvents.length} sự kiện)</td>
                    <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 800, color: 'var(--color-brand)', fontSize: 13 }}>{formatNumber(totalBudget)}</td>
                    <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{formatNumber(totalDerived.khqt)}</td>
                    <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 700, color: '#06b6d4' }}>{formatNumber(totalDerived.testDrives)}</td>
                    <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{formatNumber(totalDerived.gdtd)}</td>
                    <td style={{ border: '1px solid var(--color-border)', padding: '0 8px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatNumber(totalDerived.khd)}</td>
                    <td style={{ border: '1px solid var(--color-border)' }}></td>
                  </tr>
                  </>);
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-bar-item">
            Dữ liệu kỳ: Tháng {String(month).padStart(2, '0')}/{year} | {DEMO_BRANDS.reduce((s, b) => s + b.models.filter(m => !m.startsWith('Tổng ')).length, 0)} dòng xe
          </div>
          <div className="status-bar-item">
            Tổng thương hiệu: {DEMO_BRANDS.length}
          </div>
          <div className="status-bar-item" style={{ display: 'flex', alignItems: 'center' }}>
            <Keyboard size={14} style={{ marginRight: 4 }} /> Tab/Enter/Arrow để di chuyển
          </div>
          <div className="status-bar-item">
            Hà Nội, {mounted ? new Date().toLocaleDateString('vi-VN') : '...'}
          </div>
        </div>
      </div>

      {/* Allocation Modal */}
      {allocationModal?.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAllocationModal(null)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)', width: 600, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'scaleInId 0.2s ease-out', border: '1px solid var(--color-border-dark)' }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {allocationModal.type === 'brand' ? <Wand2 size={15} color="var(--color-brand)" /> : <Zap size={15} color="var(--color-warning)" />}
                {allocationModal.type === 'brand' ? `Phân bổ tổng: Dòng xe ${allocationModal.name}` : `Điều chỉnh hàng loạt: ${allocationModal.type === 'category' ? 'Nhóm kênh' : 'Kênh'} ${allocationModal.name} (${selectedShowroom === 'all' ? 'Lỗi: Chưa chọn SR' : selectedShowroom})`}
              </h3>
              <button onClick={() => setAllocationModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={15} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {allocationModal.type === 'brand' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Ngân sách phân bổ (Trđ)</label>
                    <input type="number" id="alloc-budget" className="form-input" style={{ width: '100%' }} placeholder="VD: 1500" autoFocus />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Kênh áp dụng</label>
                    <select className="form-select" id="alloc-channel" style={{ width: '100%' }}>
                      <option value="all">Tất cả các kênh</option>
                      {CHANNELS.filter(c => c.name !== 'Tổng Digital').map(c => (
                        <option key={c.name} value={c.name}>Chỉ kênh {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Phương thức chia</label>
                    <select className="form-select" id="alloc-action" style={{ width: '100%' }}>
                      <option value="weight">Chia theo tỷ trọng lịch sử</option>
                      <option value="even">Cào bằng (Chia đều)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Nguồn đối chiếu tỷ trọng</label>
                    <select className="form-select" id="alloc-base" style={{ width: '100%', background: '#f8fafc' }} defaultValue={month === 1 ? 12 : month - 1}>
                      <option value="current">Tháng hiện hành (T{month})</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        m !== month && <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(allocationModal.type === 'channel' || allocationModal.type === 'category') && (
                <>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, fontWeight: 600 }}>
                      CÔNG CỤ XÂY DỰNG KẾ HOẠCH MARKETING: Tuỳ chỉnh <strong>{allocationModal.name === 'Tổng Digital' ? 'Tất cả các kênh Digital' : `${allocationModal.type === 'category' ? 'Nhóm kênh' : 'Kênh'} ${allocationModal.name}`}</strong> tại <strong>{selectedShowroom}</strong> cho <strong>Tháng {month}</strong>.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                      Bạn muốn lấy tháng nào làm cơ sở dữ liệu để mô phỏng?
                    </label>
                    <select className="form-select" id="alloc-base" style={{ width: '100%', background: '#f8fafc' }} defaultValue={month === 1 ? 12 : month - 1}>
                      <option value="current">Sao chép tỷ lệ và CPL của Tháng hiện hành (T{month})</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        m !== month && <option key={m} value={m}>Sao chép tỷ lệ và CPL của Tháng {m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                      <label style={{ display: 'block', fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        Mức biến động Ngân sách
                      </label>
                      <div style={{ fontSize: 24, fontWeight: 700, color: massPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {massPercent > 0 ? '+' : ''}{massPercent}%
                      </div>
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '16px 12px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input 
                          type="range" 
                          min="-100" 
                          max="500" 
                          step="5"
                          value={massPercent}
                          onChange={(e) => setMassPercent(parseInt(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--color-brand)', cursor: 'pointer' }}
                        />
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <input 
                            type="number" 
                            className="form-input"
                            style={{ 
                              width: 80, textAlign: 'center', fontWeight: 600, paddingRight: 20
                            }} 
                            value={massPercent}
                            onChange={(e) => setMassPercent(parseInt(e.target.value) || 0)}
                          />
                          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#64748b', pointerEvents: 'none' }}>%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        <span>-100%</span>
                        <span>0%</span>
                        <span>+500%</span>
                      </div>
                    </div>
                  </div>

                  {/* Giải thích Thuật toán */}
                  <div style={{ background: '#f0fdf4', borderLeft: '3px solid #22c55e', padding: '10px 14px', borderRadius: '0 6px 6px 0', marginTop: 4 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: '#166534', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>
                      Logic Phân bổ Khách hàng (Funnel Sync)
                    </h4>
                    <p style={{ margin: 0, fontSize: 11, color: '#15803d', lineHeight: 1.5 }}>
                      Hệ thống không chia lại khách hàng theo CPL chuẩn (tránh làm sai lệch dữ liệu thực tế lịch sử). Thay vào đó, khi ngân sách thay đổi <strong>{massPercent}%</strong>, mọi chỉ số khách hàng phái sinh (KHQT, GDTD, KHĐ) cũng sẽ được tịnh tiến <strong>{massPercent}%</strong>. Điều này đảm bảo Tỷ lệ chuyển đổi (CR) và CPL của tháng tham chiếu được bảo toàn 100%.
                    </p>
                  </div>
                </>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="button-erp-secondary" onClick={() => setAllocationModal(null)}>Hủy bỏ</button>
              <button className="button-erp-primary" onClick={handleExecuteAllocation}>Thực thi ngay</button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInId {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0.08); }
        }
        @keyframes scaleInId {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .hide-spin-button::-webkit-inner-spin-button,
        .hide-spin-button::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-spin-button {
          -moz-appearance: textfield;
        }
        .cell-wrapper {
          user-select: none;
          -webkit-user-select: none;
        }
      `}} />

      {/* Confirm Component */}
      {confirmInfo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmInfo(null)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 360, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'scaleInId 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
             <div style={{ padding: 24, textAlign: 'center' }}>
               <div style={{ 
                 background: confirmInfo.type === 'submit' ? '#e0f2fe' : '#f0f9ff', 
                 width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
               }}>
                 {confirmInfo.type === 'submit' ? <Send size={28} color="#0284c7" strokeWidth={2.5} /> : <Save size={28} color="#0284c7" strokeWidth={2.5} />}
               </div>
               <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>{confirmInfo.title}</h3>
               <p style={{ color: '#475569', fontSize: 14, margin: '0 0 24px 0', lineHeight: 1.5 }}>{confirmInfo.message}</p>
               <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                 <button 
                   className="button-erp-secondary" 
                   style={{ flex: 1, padding: '10px', textAlign: 'center', justifyContent: 'center' }}
                   onClick={() => setConfirmInfo(null)}
                 >
                   Hủy
                 </button>
                 <button 
                   className="button-erp-primary" 
                   style={{ flex: 1, padding: '10px', textAlign: 'center', justifyContent: 'center' }}
                   onClick={() => {
                      if (confirmInfo.type === 'delete' && pendingDeleteFn) {
                          pendingDeleteFn();
                          setPendingDeleteFn(null);
                      } else if (confirmInfo.type === 'save') {
                          upsertBudgetPlan(month, dataByMonth[month], notesByMonth[month] || {}, approvalStatus, activeUnitId === 'all' ? undefined : activeUnitId);
                          setAlertInfo({ type: 'success', title: 'Lưu bản nháp thành công', message: 'Dữ liệu của bạn đã được ghi nhận an toàn vào hệ thống DB.' });
                      } else if (confirmInfo.type === 'submit') {
                          upsertBudgetPlan(month, dataByMonth[month], notesByMonth[month] || {}, 'pending', activeUnitId === 'all' ? undefined : activeUnitId);
                          setApprovalStatus('pending');
                          setAlertInfo({ type: 'success', title: 'Gửi duyệt thành công', message: 'Kế hoạch đã được bảo vệ và chuyển tới Cấp quản lý.' });
                      } else if ((confirmInfo.type as string) === 'submit-actual') {
                          handleSubmitActual();
                      }
                      setConfirmInfo(null);
                   }}
                 >
                   Xác nhận
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {eventModal.open && eventModal.data && (
        <EventFormModal 
          isNew={eventModal.isNew}
          initialData={eventModal.data}
          fixedShowroom={selectedShowroom !== 'all' && !eventModal.isNew ? eventModal.data.showroom : undefined}
          onClose={() => setEventModal({ open: false, data: null, isNew: false })}
          onSave={async (data) => {
            const success = await upsertEventToDB(data);
            if (!success) return;
            if (eventModal.isNew) {
              setEvents([...events, data]);
            } else {
              setEvents(events.map(ev => ev.id === data.id ? data : ev));
            }
            setEventModal({ open: false, data: null, isNew: false });
          }}
        />
      )}


      {/* ── FLOATING SAVE BAR — hiện khi actual mode + draft + có thay đổi ── */}
      {pageMode === 'actual' && isActualSplitMode && isDirtyActual && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 60%, #fffbeb 100%)',
          borderTop: '2px solid #f59e0b',
          boxShadow: '0 -4px 16px rgba(245,158,11,0.2)',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
          animation: 'slideInId 0.2s ease-out',
        }}>
          {/* Left: indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: '#f59e0b',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', whiteSpace: 'nowrap' }}>
              T{month}/{year} — chưa lưu
            </span>
            <Badge variant="warning-light" size="xs">● Chưa lưu</Badge>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleDiscardActual}
              style={{
                height: 28, padding: '0 12px', borderRadius: 5,
                border: '1px solid #fcd34d', background: '#fff',
                color: '#92400e', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <X size={12} /> Huỷ
            </button>
            <button
              onClick={handleSaveActual}
              style={{
                height: 28, padding: '0 14px', borderRadius: 5,
                border: '1px solid #f59e0b', background: '#fff7ed',
                color: '#b45309', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Save size={12} /> Lưu TH
            </button>
            <button
              onClick={() => setConfirmInfo({ type: 'submit-actual' as never, title: 'Xác nhận Nộp số thực hiện', message: `Sau khi nộp, số thực hiện tháng ${month}/${year} sẽ được chốt và không thể chỉnh sửa. Bạn có chắc chắn?` })}
              style={{
                height: 28, padding: '0 16px', borderRadius: 5,
                border: 'none', background: '#059669',
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: '0 2px 6px rgba(5,150,105,0.35)',
              }}
            >
              <CloudUpload size={13} /> Nộp TH
            </button>
          </div>
        </div>
      )}

      {/* Alert Component */}
      {alertInfo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAlertInfo(null)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 360, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'scaleInId 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
             <div style={{ padding: 24, textAlign: 'center' }}>
               <div style={{ 
                 background: alertInfo.type === 'success' ? '#dcfce7' : alertInfo.type === 'info' ? '#e0f2fe' : '#fef2f2', 
                 width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
               }}>
                 {alertInfo.type === 'success' ? <CheckCircle2 size={28} color="#16a34a" strokeWidth={2.5} /> : 
                  alertInfo.type === 'info' ? <Send size={28} color="#0284c7" strokeWidth={2.5} /> : 
                  <AlertTriangle size={28} color="#dc2626" strokeWidth={2.5} />}
               </div>
               <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>{alertInfo.title}</h3>
               <p style={{ color: '#475569', fontSize: 14, margin: '0 0 24px 0', lineHeight: 1.5 }}>{alertInfo.message}</p>
               <button 
                 className="button-erp-primary" 
                 style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                 onClick={() => setAlertInfo(null)}
               >
                 Đã hiểu
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
