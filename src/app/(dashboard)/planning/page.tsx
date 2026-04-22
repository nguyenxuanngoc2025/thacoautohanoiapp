'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { formatNumber, cn } from '@/lib/utils';
import { CHANNEL_CATEGORIES } from '@/lib/constants';
import { DownloadCloud, UploadCloud, Save, Send, Wallet, Users, FileSignature, BarChart3, Wand2, Zap, X, CheckCircle2, AlertTriangle, Edit2, Trash2, ArrowUpRight, CalendarDays, Keyboard, ChevronDown, CloudUpload, Lock } from 'lucide-react';
import { Badge } from '@/components/reui/badge';
import { type EventItem, EVENT_CPL, EVENT_CR1, EVENT_CR2 } from '@/lib/events-data';
import { useBudgetEntriesByShowroom, useBudgetEntriesByShowroomIds, useEventsData, invalidateBudgetCaches } from '@/lib/use-data';
import { upsertBudgetEntries, cellDataToEntries, makeCellKey } from '@/lib/db/budget-entries';
import type { BudgetEntryRow } from '@/types/database';
import { useBrands } from '@/contexts/BrandsContext';
import { useShowrooms } from '@/contexts/ShowroomsContext';
import { useUnit } from '@/contexts/UnitContext';
import { useChannels } from '@/contexts/ChannelsContext';
import type { Channel } from '@/contexts/ChannelsContext';
import { useAuth } from '@/contexts/AuthContext';


// CHANNELS được cung cấp động bởi ChannelsContext — xem useChannels() bên dưới
// Giữ lại METRICS, COL_WIDTH và helper function ở đây

const METRICS = ['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'];

// Fixed widths for sticky columns
const COL1_WIDTH = 120;
const COL2_WIDTH = 130;

// Channel category color map (fallback only for categories without channel-level color)
const CATEGORY_COLOR_MAP: Record<string, string> = {};
CHANNEL_CATEGORIES.forEach(c => { CATEGORY_COLOR_MAP[c.value] = c.color; });


interface CellData {
  [key: string]: number;
}

// ─── Key Translation Bridge ───────────────────────────────────────────────────
// Grid uses legacy format: "brand-model-channelName-metricVN"
// DB uses new format:      "brand|||model|||channelCode|||metricCode"
// These helpers translate between the two WITHOUT changing grid logic.

const METRIC_VN_TO_CODE: Record<string, 'ns' | 'khqt' | 'gdtd' | 'khd'> = {
  'Ngân sách': 'ns', 'KHQT': 'khqt', 'GDTD': 'gdtd', 'KHĐ': 'khd',
};
const METRIC_CODE_TO_VN: Record<string, string> = {
  'ns': 'Ngân sách', 'khqt': 'KHQT', 'gdtd': 'GDTD', 'khd': 'KHĐ',
};

/**
 * Convert BudgetEntryRow[] from DB → legacy CellData used by the grid.
 * Legacy key format: "brand-model-channelName-metricVN"
 */
function entriesToLegacyCellData(
  rows: BudgetEntryRow[],
  channels: Channel[],
  mode: 'plan' | 'actual'
): CellData {
  // Build code→name map for channels
  const codeToName = new Map<string, string>(channels.map(c => [c.code, c.name]));
  const result: CellData = {};
  for (const row of rows) {
    const chName = codeToName.get(row.channel_code) ?? row.channel_code;
    for (const [metricVN, metricCode] of Object.entries(METRIC_VN_TO_CODE)) {
      const col = `${mode}_${metricCode}` as keyof BudgetEntryRow;
      const val = row[col] as number | null;
      if (val !== null && val !== undefined) {
        result[`${row.brand_name}-${row.model_name}-${chName}-${metricVN}`] = val;
      }
    }
  }
  return result;
}

/**
 * Convert legacy CellData from the grid → EntryInput[] for DB upsert.
 * Legacy key format: "brand-model-channelName-metricVN"
 */
function legacyCellDataToEntries(
  cellData: CellData,
  channels: Channel[],
  unitId: string,
  showroomId: string,
  year: number,
  month: number,
  mode: 'plan' | 'actual'
) {
  const nameToCode = new Map<string, string>(channels.map(c => [c.name, c.code]));
  // Convert legacy keys to new ||| format then call cellDataToEntries
  const newCellData: Record<string, number | null> = {};
  for (const [legacyKey, val] of Object.entries(cellData)) {
    const parts = legacyKey.split('-');
    if (parts.length < 4) continue;
    // metric is last part, channel is second-to-last, model may contain dashes
    const metricVN = parts[parts.length - 1];
    const chName = parts[parts.length - 2];
    const modelName = parts.slice(1, parts.length - 2).join('-');
    const brandName = parts[0];
    const metricCode = METRIC_VN_TO_CODE[metricVN];
    const chCode = nameToCode.get(chName);
    if (!metricCode || !chCode) continue;
    // Skip aggregate/readonly channels
    const ch = channels.find(c => c.name === chName);
    if (ch?.readonly || ch?.isAggregate) continue;
    newCellData[makeCellKey(brandName, modelName, chCode, metricCode)] = val ?? null;
  }
  return cellDataToEntries(newCellData as Record<string, number | null>, unitId, showroomId, year, month, mode);
}

// --- Types hoisted out of component for performance ---
type AlertState = { type: 'warning' | 'success' | 'info', title: string, message: string };


type CellNotes = Record<string, string>;

// Module-level cache removed — data is now managed by SWR via useBudgetEntriesByShowroom

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
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: typeof width === 'number' ? Math.max(width, 220) : '100%', minWidth: 220, background: '#fff', border: '1px solid var(--color-border-dark)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 200, display: 'flex', flexDirection: 'column', animation: 'scaleInId 0.15s ease-out', transformOrigin: 'top left' }}>
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
  const { brands } = useBrands();
  const { showrooms, showroomNames: SHOWROOMS } = useShowrooms();
  const { activeUnitId } = useUnit();
  const { channels: CHANNELS, digitalChannelNames } = useChannels();
  const { isLoading: authIsLoading, profile, effectiveRole, accessibleShowroomCodes } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedShowroom, setSelectedShowroom] = useState('all');
  const selectedShowroomCode = useMemo(() => {
    if (selectedShowroom === 'all') return null;
    return showrooms.find(s => s.name === selectedShowroom)?.code?.toUpperCase() ?? null;
  }, [selectedShowroom, showrooms]);

  // UUID of selected showroom — needed for thaco_budget_entries queries
  // Guard: chỉ dùng real UUID (không dùng fallback-N từ STATIC_FALLBACK của ShowroomsContext)
  const selectedShowroomId = useMemo(() => {
    if (selectedShowroom === 'all') return null;
    const id = showrooms.find(s => s.name === selectedShowroom)?.id ?? null;
    // Validate UUID format — reject fallback-N IDs from static fallback data
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
    return id;
  }, [selectedShowroom, showrooms]);

  // Brands hiển thị — lọc theo brands của showroom đang chọn (nếu có)
  const visibleBrands = useMemo(() => {
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
  const [undoStack, setUndoStack] = useState<CellData[]>([]);

  // Spreadsheet Selection State
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStartIdx, setSelectionStartIdx] = useState<number>(-1);

  
  const availableModels = useMemo(() => {
    if (selectedBrand === 'all') return Array.from(new Set(brands.flatMap(b => b.models)));
    return brands.find(b => b.name === selectedBrand)?.models || [];
  }, [selectedBrand, brands]);

  // ─── Source of Truth: per-showroom data from DB ────────────────────────
  const [showroomDataByMonth, setShowroomDataByMonth] = useState<Record<number, Record<string, CellData>>>({});
  const [showroomActualDataByMonth, setShowroomActualDataByMonth] = useState<Record<number, Record<string, CellData>>>({});

  // Approval / Actual status per-SR per-month (populated by loadData)
  const [approvalMapByMonthSR, setApprovalMapByMonthSR] = useState<Record<number, Record<string, string>>>({});
  const [actualStatusMapByMonthSR, setActualStatusMapByMonthSR] = useState<Record<number, Record<string, string>>>({});

  // ─── Derived data via useMemo — synchronous, eliminates flicker ────────
  // Data is now keyed by showroomId (UUID) in showroomDataByMonth
  const dataByMonth = useMemo(() => {
    const result: Record<number, CellData> = {};
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m => {
      if (showroomDataByMonth[m]) {
        if (selectedShowroom === 'all') {
          result[m] = {};
          Object.values(showroomDataByMonth[m]).forEach(payload => {
            Object.keys(payload).forEach(k => {
              result[m][k] = (result[m][k] || 0) + (payload[k] || 0);
            });
          });
        } else {
          const id = selectedShowroomId || Object.keys(showroomDataByMonth[m])[0] || null;
          result[m] = id ? { ...(showroomDataByMonth[m][id] || {}) } : {};
        }
      }
    });
    return result;
  }, [showroomDataByMonth, selectedShowroom, selectedShowroomId]);

  const actualDataByMonth = useMemo(() => {
    const result: Record<number, CellData> = {};
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m => {
      if (showroomActualDataByMonth[m]) {
        if (selectedShowroom === 'all') {
          result[m] = {};
          Object.values(showroomActualDataByMonth[m]).forEach(payload => {
            Object.keys(payload).forEach(k => {
              result[m][k] = (result[m][k] || 0) + (payload[k] || 0);
            });
          });
        } else {
          const id = selectedShowroomId || Object.keys(showroomActualDataByMonth[m])[0] || null;
          result[m] = id ? { ...(showroomActualDataByMonth[m][id] || {}) } : {};
        }
      }
    });
    return result;
  }, [showroomActualDataByMonth, selectedShowroom, selectedShowroomId]);

  const approvalStatus = useMemo(() => {
    if (!selectedShowroomCode) return 'draft';
    return approvalMapByMonthSR[month]?.[selectedShowroomCode] || 'draft';
  }, [approvalMapByMonthSR, month, selectedShowroomCode]);

  // ─── Plan submission + lock status ────────────────────────────────────────
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'sent'>('draft');
  const [periodLocked, setPeriodLocked] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  // Track "GĐ SR đã xem" — chỉ ghi nhận 1 lần mỗi lần chọn SR trong session
  const viewedRef = useRef<Set<string>>(new Set());

  // Auto-save status indicator: idle | editing | saving | saved | error
  const [saveStatus, setSaveStatus] = useState<'idle' | 'editing' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [retrySaveTrigger, setRetrySaveTrigger] = useState(0);

  // ─── Mode switcher: KẾ HOẠCH / THỰC HIỆN ─────────────────────────────────
  const [pageMode, setPageMode] = useState<'plan' | 'actual'>('plan');
  
  // Dirty tracking — true khi user edit actual data chưa được lưu
  const [isDirtyActual, setIsDirtyActual] = useState(false);
  // Snapshot để hỗ trợ discard changes
  const lastSavedActualSnapshot = useRef<CellData | null>(null);

  // Mode-aware cell data — aggregate theo viewMode
  const cellData = useMemo(() => {
    const sourceMap = pageMode === 'plan' ? dataByMonth : actualDataByMonth;
    if (viewMode === 'month') return sourceMap[month] || {};
    const months = viewMode === 'quarter'
      ? [month, month + 1, month + 2].filter(m => m >= 1 && m <= 12)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result: CellData = {};
    for (const m of months) {
      for (const [k, v] of Object.entries(sourceMap[m] || {})) {
        result[k] = (result[k] || 0) + ((v as number) || 0);
      }
    }
    return result;
  }, [pageMode, viewMode, month, dataByMonth, actualDataByMonth]);

  // Plan data aggregate (dùng cho ghost value trong actual mode)
  const planCellData = useMemo(() => {
    if (viewMode === 'month') return dataByMonth[month] || {};
    const months = viewMode === 'quarter'
      ? [month, month + 1, month + 2].filter(m => m >= 1 && m <= 12)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result: CellData = {};
    for (const m of months) {
      for (const [k, v] of Object.entries(dataByMonth[m] || {})) {
        result[k] = (result[k] || 0) + ((v as number) || 0);
      }
    }
    return result;
  }, [viewMode, month, dataByMonth]);

  // ─── Edit lock guard (mode-aware) ────────────────────────────────────────
  // Bottom-Up Phase 1: aggregate view (all SRs) is always read-only
  const isAggregateView = selectedShowroom === 'all';

  // Plan mode: locked khi showroom = 'all' HOẶC kế hoạch không ở draft / submitted / approved
  // Actual mode: locked khi entry đã submitted
  // Thêm: khóa khi kỳ đã bị khóa bởi admin, hoặc role chỉ xem
  const isDataLocked = isAggregateView || viewMode !== 'month' || periodLocked
    || effectiveRole === 'gd_showroom' || effectiveRole === 'bld' || effectiveRole === 'finance';

  // Actual split mode: draft months show Plan | Actual 2-column layout
  const actualEntryStatus = selectedShowroomCode ? (actualStatusMapByMonthSR[month]?.[selectedShowroomCode] || 'draft') : 'draft';
  const isActualSplitMode = pageMode === 'actual' && actualEntryStatus === 'draft' && viewMode === 'month';

  const setCellData = useCallback((action: React.SetStateAction<CellData>) => {
    if (!selectedShowroomId) return; // Guard: can't edit in aggregate view
    hasPendingEdits.current = true;
    // Reset trạng thái Gửi về draft khi user chỉnh sửa lại
    setSubmitStatus(prev => prev === 'sent' ? 'draft' : prev);
    if (pageMode === 'plan') {
      setShowroomDataByMonth(cache => {
        const current = cache[month]?.[selectedShowroomId] || {};
        const next = typeof action === 'function' ? action(current) : action;
        return {
          ...cache,
          [month]: { ...(cache[month] || {}), [selectedShowroomId]: next }
        };
      });
    } else {
      setShowroomActualDataByMonth(cache => {
        const current = cache[month]?.[selectedShowroomId] || {};
        const next = typeof action === 'function' ? action(current) : action;
        return {
          ...cache,
          [month]: { ...(cache[month] || {}), [selectedShowroomId]: next }
        };
      });
      setIsDirtyActual(true);
    }
  }, [month, pageMode, selectedShowroomId]);

  // ─── Auto-select showroom cho gd_showroom + mkt_showroom khi trang mở ───────
  useEffect(() => {
    if (
      (effectiveRole === 'gd_showroom' || effectiveRole === 'mkt_showroom') &&
      accessibleShowroomCodes.length > 0 &&
      selectedShowroom === 'all' &&
      showrooms.length > 0
    ) {
      const code = accessibleShowroomCodes[0];
      const sr = showrooms.find(s =>
        s.code?.toUpperCase() === code?.toUpperCase()
      );
      if (sr) setSelectedShowroom(sr.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRole, accessibleShowroomCodes, showrooms]);

  // ─── Fetch plan submission + lock status ───────────────────────────────────
  useEffect(() => {
    if (!selectedShowroomId || !activeUnitId) {
      setSubmitStatus('draft');
      setPeriodLocked(false);
      return;
    }
    const entry_type = pageMode === 'plan' ? 'plan' : 'actual';
    fetch(
      `/api/planning/status?showroom_id=${selectedShowroomId}&unit_id=${activeUnitId}&year=${year}&month=${month}&entry_type=${entry_type}`
    )
      .then(r => r.json())
      .then(data => {
        setSubmitStatus(data.submission || 'draft');
        setPeriodLocked(data.locked || false);
      })
      .catch(() => {});
  }, [selectedShowroomId, activeUnitId, year, month, pageMode]);

  // ─── Ghi nhận GĐ SR đã xem ────────────────────────────────────────────────
  useEffect(() => {
    if (effectiveRole !== 'gd_showroom') return;
    if (!selectedShowroomId || !selectedShowroom || selectedShowroom === 'all') return;
    const viewKey = `${selectedShowroomId}-${year}-${month}`;
    if (viewedRef.current.has(viewKey)) return;
    viewedRef.current.add(viewKey);
    fetch('/api/planning/viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showroom_id: selectedShowroomId,
        unit_id: activeUnitId,
        year,
        month,
        showroom_name: selectedShowroom,
        viewer_name: profile?.full_name || profile?.email || '',
      }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRole, selectedShowroomId, year, month]);

  // ─── Gửi kế hoạch ─────────────────────────────────────────────────────────
  const handleSubmitPlan = useCallback(async () => {
    if (!selectedShowroomId || !activeUnitId) return;
    setSubmitLoading(true);
    try {
      const entry_type = pageMode === 'plan' ? 'plan' : 'actual';
      const res = await fetch('/api/planning/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showroom_id: selectedShowroomId,
          unit_id: activeUnitId,
          year,
          month,
          entry_type,
          showroom_name: selectedShowroom,
          sender_name: profile?.full_name || profile?.email || '',
        }),
      });
      if (res.ok) {
        setSubmitStatus('sent');
        const typeLabel = entry_type === 'plan' ? 'KH' : 'TH';
        setAlertInfo({ type: 'success', title: 'Đã gửi', message: `Kế hoạch ${typeLabel} tháng ${month}/${year} đã được gửi thành công.` });
      }
    } finally {
      setSubmitLoading(false);
    }
  }, [selectedShowroomId, activeUnitId, year, month, pageMode, selectedShowroom, profile]);

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

    return null;
  }, [dataByMonth, actualDataByMonth, month, cellData, brands, digitalChannelNames]);

  // Bottom-Up: no weight scaling; data is already per-SR
  const getHistoricalValue = useCallback((cellKey: string, mode: string): number | null => {
    return getRawHistoricalValue(cellKey, mode);
  }, [getRawHistoricalValue]);

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
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '-0.02em' }}>
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
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '-0.02em' }}>
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
  // DIGITAL sub-group collapse — mặc định thu gọn
  const [digitalCollapsed, setDigitalCollapsed] = useState(true);
  // Metric columns visibility
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(new Set());
  
  // Events — lưu theo tháng, KHQT/GDTD/KHĐ được derive từ cellData
  const [eventsByMonth, setEventsByMonth] = useState<Record<number, EventItem[]>>({});

  // ─── SWR: Load budget entries from thaco_budget_entries ──────────────────
  // thaco_budget_entries stores both plan_* and actual_* columns in the same row.
  // One query per (showroom, year, month) fetches data for both modes.
  // SWR handles caching, deduplication and background revalidation.
  const {
    data: budgetEntryRows,
    isLoading: isEntriesLoading,
  } = useBudgetEntriesByShowroom(selectedShowroomId, year, month);

  // ─── SWR: Aggregate view — load ALL showrooms for unit ───────────────────
  // Dùng showroom_id[] thay vì unit_id để tránh mismatch khi unit_id chưa load
  // Chỉ fetch khi showrooms đã có real data (không dùng STATIC_FALLBACK)
  const aggShowroomIds = useMemo(() => {
    if (selectedShowroom !== 'all') return null;
    const realSRs = showrooms.filter(s => !s.id.startsWith('fallback'));
    return realSRs.length > 0 ? realSRs.map(s => s.id) : null;
  }, [selectedShowroom, showrooms]);

  const { data: unitBudgetEntryRows } = useBudgetEntriesByShowroomIds(aggShowroomIds, year, month);

  // unitIdForAggFetch: dùng cho events fetch (cần unit_id, không có showroom_id[])
  const unitIdForAggFetch = useMemo(() => {
    if (activeUnitId && activeUnitId !== 'all') return activeUnitId;
    const realSr = showrooms.find(s => s.unit_id && !s.id.startsWith('fallback'));
    return realSr?.unit_id ?? null;
  }, [activeUnitId, showrooms]);

  // ─── SWR: Events ──────────────────────────────────────────────────────────
  const { data: eventsFromDB } = useEventsData(unitIdForAggFetch ?? undefined);

  // isDataLoading: true until first fetch completes for selected showroom
  const isDataLoading = isEntriesLoading && selectedShowroom !== 'all';

  // Sync SWR data → showroomDataByMonth and showroomActualDataByMonth state
  const justLoadedFromDB = useRef(false);
  // Guard: không overwrite state khi user đang có edits chưa được lưu
  const hasPendingEdits = useRef(false);
  useEffect(() => {
    if (!selectedShowroomId || !budgetEntryRows) return;
    // Nếu user đang có edits chưa lưu, bỏ qua SWR revalidation để tránh mất data
    if (hasPendingEdits.current) return;
    const planLegacy = entriesToLegacyCellData(budgetEntryRows, CHANNELS, 'plan');
    const actualLegacy = entriesToLegacyCellData(budgetEntryRows, CHANNELS, 'actual');
    setShowroomDataByMonth(prev => ({
      ...prev,
      [month]: { ...(prev[month] || {}), [selectedShowroomId]: planLegacy },
    }));
    setShowroomActualDataByMonth(prev => ({
      ...prev,
      [month]: { ...(prev[month] || {}), [selectedShowroomId]: actualLegacy },
    }));
    justLoadedFromDB.current = true;
  }, [budgetEntryRows, selectedShowroomId, month, CHANNELS]);

  // ─── Sync unit-level entries → showroomDataByMonth (aggregate view) ───────
  useEffect(() => {
    if (!unitBudgetEntryRows || selectedShowroom !== 'all') return;
    const byShowroom: Record<string, BudgetEntryRow[]> = {};
    for (const row of unitBudgetEntryRows) {
      if (!byShowroom[row.showroom_id]) byShowroom[row.showroom_id] = [];
      byShowroom[row.showroom_id].push(row);
    }
    setShowroomDataByMonth(prev => ({
      ...prev,
      [month]: Object.fromEntries(
        Object.entries(byShowroom).map(([srId, rows]) =>
          [srId, entriesToLegacyCellData(rows, CHANNELS, 'plan')]
        )
      )
    }));
    setShowroomActualDataByMonth(prev => ({
      ...prev,
      [month]: Object.fromEntries(
        Object.entries(byShowroom).map(([srId, rows]) =>
          [srId, entriesToLegacyCellData(rows, CHANNELS, 'actual')]
        )
      )
    }));
  }, [unitBudgetEntryRows, selectedShowroom, month, CHANNELS]);

  // ─── Sync events from DB → eventsByMonth ──────────────────────────────────
  useEffect(() => {
    if (!eventsFromDB) return;
    setEventsByMonth(eventsFromDB);
  }, [eventsFromDB]);

  // Set mounted once data arrives (or immediately if no showroom selected)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Auto-save PLAN data (debounce 400ms) ────────────────────────────────
  const lastSavedPayload = useRef<string>('');
  React.useEffect(() => {
    if (!mounted || pageMode !== 'plan') return;
    if (selectedShowroom === 'all' || !selectedShowroomId) return;

    const currentPayload = dataByMonth[month];
    if (!currentPayload || Object.keys(currentPayload).length === 0) return;
    const payloadStr = JSON.stringify(currentPayload);

    // Skip auto-save right after DB load — data hasn't been edited yet
    if (justLoadedFromDB.current) {
      justLoadedFromDB.current = false;
      lastSavedPayload.current = payloadStr;
      return;
    }

    if (payloadStr === lastSavedPayload.current) return;

    setSaveStatus('editing');
    // Khi super_admin ở mode 'all', dùng unit_id của showroom đang chọn
    const srUnitId = showrooms.find(s => s.name === selectedShowroom)?.unit_id ?? '';
    const unitIdForSave = (activeUnitId && activeUnitId !== 'all') ? activeUnitId : srUnitId;
    if (!unitIdForSave) { setSaveStatus('error'); return; }

    const timeout = setTimeout(() => {
      setSaveStatus('saving');
      const entries = legacyCellDataToEntries(currentPayload, CHANNELS, unitIdForSave, selectedShowroomId, year, month, 'plan');
      upsertBudgetEntries(entries)
        .then(() => {
          lastSavedPayload.current = payloadStr;
          hasPendingEdits.current = false;
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          invalidateBudgetCaches(unitIdForSave, selectedShowroomId, year, month);
        })
        .catch(() => setSaveStatus('error'));
    }, 400);
    return () => clearTimeout(timeout);
  }, [dataByMonth, month, mounted, pageMode, activeUnitId, selectedShowroom, selectedShowroomId, year, retrySaveTrigger, CHANNELS]);

  // Reset dirty flag khi chuyển tháng
  React.useEffect(() => {
    setIsDirtyActual(false);
    // Lưu snapshot khi load actual data xong
    lastSavedActualSnapshot.current = actualDataByMonth[month] || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Reset hasPendingEdits khi chuyển showroom — cho phép DB load mới nhất
  React.useEffect(() => {
    hasPendingEdits.current = false;
  }, [selectedShowroomId]);

  // ─── Auto-save ACTUAL data (debounce 400ms) ──────────────────────────────
  const lastSavedActualPayload = useRef<string>('');
  React.useEffect(() => {
    if (!mounted || pageMode !== 'actual') return;
    if (selectedShowroom === 'all' || !selectedShowroomId) return;

    const currentPayload = actualDataByMonth[month];
    if (!currentPayload || Object.keys(currentPayload).length === 0) return;
    const payloadStr = JSON.stringify(currentPayload);

    if (payloadStr === lastSavedActualPayload.current) return;

    setSaveStatus('editing');
    // Khi super_admin ở mode 'all', dùng unit_id của showroom đang chọn
    const srUnitId = showrooms.find(s => s.name === selectedShowroom)?.unit_id ?? '';
    const unitIdForSave = (activeUnitId && activeUnitId !== 'all') ? activeUnitId : srUnitId;
    if (!unitIdForSave) { setSaveStatus('error'); return; }

    const timeout = setTimeout(() => {
      setSaveStatus('saving');
      const entries = legacyCellDataToEntries(currentPayload, CHANNELS, unitIdForSave, selectedShowroomId, year, month, 'actual');
      upsertBudgetEntries(entries)
        .then(() => {
          lastSavedActualPayload.current = payloadStr;
          hasPendingEdits.current = false;
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          setIsDirtyActual(false);
          invalidateBudgetCaches(unitIdForSave, selectedShowroomId, year, month);
        })
        .catch(() => setSaveStatus('error'));
    }, 400);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualDataByMonth, month, mounted, pageMode, activeUnitId, selectedShowroom, selectedShowroomId, year, retrySaveTrigger, CHANNELS]);

  // Mặc định thu gọn tất cả brands khi brands load lần đầu
  const brandsInitialized = useRef(false);
  React.useEffect(() => {
    if (!brandsInitialized.current && brands.length > 0) {
      brandsInitialized.current = true;
      setCollapsedBrands(new Set(brands.map(b => b.name)));
    }
  }, [brands]);

  const events = eventsByMonth[month] || [];

  const getRawCellValue = useCallback((cellKey: string): number => {
    if (cellKey.includes('-Tổng Digital-')) {
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

    // SSOT: luôn đọc từ cellData (thaco_budget_entries) — không đọc trực tiếp từ events
    return cellData[cellKey] || 0;
  }, [cellData, brands]);

  const getUnroundedCellValue = useCallback((cellKey: string): number => {
    return getRawCellValue(cellKey);
  }, [getRawCellValue]);

  const getCellValue = useCallback((cellKey: string): number => {
    const raw = getRawCellValue(cellKey);
    
    // Bottom-Up: data is per-SR, no weight scaling needed
    const isBudget = cellKey.endsWith('-Ngân sách') || cellKey.endsWith('-CPL');
    return isBudget ? Math.round(raw * 10) / 10 : Math.round(raw);
  }, [getRawCellValue]);

  const setEvents = useCallback((action: React.SetStateAction<EventItem[]>) => {
    setEventsByMonth(prev => {
      const current = prev[month] || [];
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [month]: next };
    });
  }, [month]);
  // Hide rows with all-zero data
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [allocationModal, setAllocationModal] = useState<{ open: boolean, type: 'brand' | 'channel' | 'category', name: string } | null>(null);
  const [massPercent, setMassPercent] = useState<number>(15);
  const [alertInfo, setAlertInfo] = useState<AlertState | null>(null);


  const [pendingDeleteFn, setPendingDeleteFn] = useState<(() => void) | null>(null);

  // Historical CPL từ actual entries — dùng trong auto-fill công thức
  const [historicalCPL, setHistoricalCPL] = useState<Record<string, number>>({});

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
    visibleBrands.forEach(b => {
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
  }, [visibleBrands, selectedBrand, selectedModels, collapsedBrands, visibleChannels, visibleMetrics, hideZeroRows, cellData]);
  
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
          setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để chỉnh sửa dữ liệu.' });
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
               setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để chỉnh sửa dữ liệu.' });
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
           setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để chỉnh sửa dữ liệu.' });
           return;
         }
         e.preventDefault();
         const first = Array.from(selectedCells)[0];     
         if (first) {
            setUndoStack(us => [...us.slice(-19), dataByMonth[month] || {}]);
            setEditingCell(first);
            setEditValue(String(getCellValue(first) || ''));
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
  }, [selectedCells, ALL_CELL_KEYS, VISIBLE_GRID_KEYS, getCellValue]);

  // Scroll shadow handler
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollLeft > 2);
    }
  }, []);

  // Inline style constants for sticky cells — prevents CSS cache issues
  const stickyHeaderCol1: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 50,
    background: '#eef2f7',
    width: COL1_WIDTH,
    minWidth: COL1_WIDTH,
    borderRight: '2px solid var(--color-border-dark)',
    borderTop: '3px solid var(--color-brand)',
    verticalAlign: 'middle',
    padding: '0 4px',
  };

  const stickyHeaderCol2: React.CSSProperties = {
    position: 'sticky',
    left: COL1_WIDTH,
    zIndex: 50,
    background: '#eef2f7',
    width: COL2_WIDTH,
    minWidth: COL2_WIDTH,
    maxWidth: COL2_WIDTH,
    overflow: 'hidden',
    borderRight: '2px solid var(--color-border-dark)',
    borderTop: '3px solid var(--color-brand)',
    verticalAlign: 'middle',
    padding: '0 4px',
  };

  const stickyBodyCol1: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 31,
    background: '#ffffff',
    width: COL1_WIDTH,
    minWidth: COL1_WIDTH,
    borderRight: '2px solid var(--color-border-dark)',
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
    borderRight: '2px solid var(--color-border-dark)',
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

  // Compute grand total — derived from brandSubtotals in O(brands) instead of O(B×M×C×K)
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
      const sub = brandSubtotals[brand.name];
      if (!sub) continue;
      budget += sub.budget; khqt += sub.khqt; gdtd += sub.gdtd; khd += sub.khd;
      histBudget += sub.histBudget; histKhqt += sub.histKhqt;
      histGdtd += sub.histGdtd; histKhd += sub.histKhd;
      for (const ch of CHANNELS) {
        for (const m of METRICS) {
          channelTotals[ch.name][m] = (channelTotals[ch.name][m] || 0) + (sub.channelTotals[ch.name]?.[m] || 0);
          histChannelTotals[ch.name][m] = (histChannelTotals[ch.name][m] || 0) + (sub.histChannelTotals[ch.name]?.[m] || 0);
        }
      }
    }

    budget = Math.round(budget * 10) / 10;
    histBudget = Math.round(histBudget * 10) / 10;
    khqt = Math.round(khqt); histKhqt = Math.round(histKhqt);
    gdtd = Math.round(gdtd); histGdtd = Math.round(histGdtd);
    khd = Math.round(khd); histKhd = Math.round(histKhd);

    return { budget, khqt, gdtd, khd, histBudget, histKhqt, histGdtd, histKhd, channelTotals, histChannelTotals };
  }, [brandSubtotals, brands, selectedBrand, CHANNELS]);

  const summary = useMemo(() => {
    return {
      budget: grandTotal.budget,
      khqt: grandTotal.khqt,
      gdtd: grandTotal.gdtd,
      khd: grandTotal.khd,
      cpl: grandTotal.khqt > 0 ? Math.round(grandTotal.budget / grandTotal.khqt * 10) / 10 : 0
    };
  }, [grandTotal]);

  // showroomEventTotals removed — Bottom-Up Phase 1: section "CHI TIẾT THEO SHOWROOM" đã bị disable

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
        const brand = visibleBrands.find(b => b.name === allocationModal.name);
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

        visibleBrands.forEach(b => {
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
          <span style={{ fontSize: 9, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <button
              className="button-erp-secondary"
              style={{ padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Export Excel"
              onClick={async () => {
                try {
                  setAlertInfo({ type: 'info', title: 'Đang xuất...', message: 'Đang tạo file Excel, vui lòng đợi.' });
                  // Build headers
                  const metricList = METRICS.filter(m => !hiddenMetrics.has(m));
                  const channelHeaders = CHANNELS.filter(c => !hiddenChannels.has(c.category)).map(c => c.name);
                  const headerRow1 = ['Thương hiệu', 'Model', ...channelHeaders.flatMap(ch => metricList.map(() => ch))];
                  const headerRow2 = ['', '', ...channelHeaders.flatMap(() => metricList)];
                  // Build data rows — Brand table
                  const dataRows: (string | number)[][] = [];
                  for (const brand of visibleBrands) {
                    const modelList = brand.models.filter(m => selectedModels.length === 0 || selectedModels.includes(m));
                    for (const model of modelList) {
                      const row: (string | number)[] = [brand.name, model];
                      for (const ch of channelHeaders) {
                        for (const metric of metricList) {
                          const key = `${brand.name}-${model}-${ch}-${metric}`;
                          row.push(cellData[key] || 0);
                        }
                      }
                      dataRows.push(row);
                    }
                  }
                  // Showroom table section
                  const exportSRs = isAggregateView
                    ? showrooms.filter(s => !s.id.startsWith('fallback'))
                    : showrooms.filter(s => s.name === selectedShowroom);
                  if (exportSRs.length > 0) {
                    dataRows.push([]); // blank separator
                    dataRows.push(['CHI TIẾT THEO SHOWROOM', ...channelHeaders.flatMap(() => metricList.map(() => ''))]);
                    for (const srObj of exportSRs) {
                      const srData = (pageMode === 'plan' ? showroomDataByMonth : showroomActualDataByMonth)[month]?.[srObj.id] || {};
                      const getChSum = (chName: string, metric: string) => {
                        let s = 0;
                        const suffix = `-${chName}-${metric}`;
                        for (const [k, v] of Object.entries(srData)) { if (k.endsWith(suffix)) s += (v as number) || 0; }
                        return s;
                      };
                      const srRow: (string | number)[] = [srObj.name, ''];
                      for (const ch of channelHeaders) {
                        for (const metric of metricList) {
                          const ch_ = CHANNELS.find(c => c.name === ch);
                          if (ch_?.isAggregate) {
                            srRow.push(digitalChannelNames.reduce((acc, dcName) => acc + getChSum(dcName, metric), 0));
                          } else {
                            srRow.push(getChSum(ch, metric));
                          }
                        }
                      }
                      dataRows.push(srRow);
                    }
                  }
                  const res = await fetch('/api/export/planning', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: `Kế hoạch ngân sách T${month}/${year} — ${selectedShowroom}`, headers: [headerRow1, headerRow2], rows: dataRows, month, year }),
                  });
                  if (!res.ok) throw new Error('Export failed');
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `KH_Thang${month}_${year}.xlsx`; a.click();
                  window.URL.revokeObjectURL(url);
                  setAlertInfo({ type: 'success', title: 'Xuất thành công', message: `File Excel đã được tải về.` });
                } catch {
                  setAlertInfo({ type: 'warning', title: 'Lỗi xuất', message: 'Không thể tạo file Excel. Kiểm tra lại.' });
                }
              }}
            >
              <DownloadCloud size={14} /> <span style={{ fontSize: 12 }}>Export</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }}></div>
            {/* Lock badge */}
            {!isAggregateView && periodLocked && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#dc2626', fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
                border: '1px solid #fca5a5', background: '#fff1f2',
              }}>
                <Lock size={11} /> Đã khóa T{month}
              </span>
            )}
            {/* Gửi button — mkt_showroom (nhập kế hoạch) + super_admin (dev/kiểm tra) */}
            {!isAggregateView && !periodLocked && viewMode === 'month'
              && (effectiveRole === 'mkt_showroom' || effectiveRole === 'mkt_brand' || effectiveRole === 'super_admin')
              && (
              <button
                className={submitStatus === 'sent' ? 'button-erp-secondary' : 'button-erp-primary'}
                style={{
                  padding: '2px 10px', height: 26, display: 'flex', alignItems: 'center', gap: 4,
                  ...(submitStatus === 'sent' ? { border: '1px solid #16a34a', color: '#16a34a', background: '#f0fdf4' } : {}),
                }}
                onClick={handleSubmitPlan}
                disabled={submitLoading || saveStatus === 'saving' || saveStatus === 'editing'}
                title={submitStatus === 'sent' ? `Đã gửi kế hoạch tháng ${month}` : 'Gửi kế hoạch cho PT Marketing'}
              >
                <Send size={13} />
                <span style={{ fontSize: 12 }}>
                  {submitLoading ? 'Đang gửi...' : submitStatus === 'sent' ? `Đã gửi T${month}` : 'Gửi'}
                </span>
              </button>
            )}
            {!isAggregateView && (
              <>
                {/* Save status indicator */}
                {saveStatus === 'editing' && (
                  <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500 }}>● Chưa lưu...</span>
                )}
                {saveStatus === 'saving' && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>Đang lưu...</span>
                )}
                {saveStatus === 'saved' && lastSavedAt && (
                  <span style={{ fontSize: 11, color: '#16a34a' }}>
                    Đã lưu {lastSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#ef4444' }}>Lỗi lưu!</span>
                    <button
                      onClick={() => {
                        if (pageMode === 'plan') lastSavedPayload.current = '';
                        else lastSavedActualPayload.current = '';
                        setRetrySaveTrigger(t => t + 1);
                      }}
                      style={{ fontSize: 10, color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 3, padding: '1px 6px', background: '#fff1f2', cursor: 'pointer', lineHeight: 1.4 }}
                      title="Thử lại lưu dữ liệu"
                    >Thử lại</button>
                  </span>
                )}
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
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', height: 34, minHeight: 34,
        borderBottom: '1px solid var(--color-border)',
        background: pageMode === 'actual' ? '#fffbeb' : 'var(--color-surface)',
        flexShrink: 0, flexWrap: 'nowrap',
      }}>
        {/* ── Mode Switcher KẾ HOẠCH / THỰC HIỆN ── */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
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


        <div className="toolbar-sep" style={{ height: 14 }} />
        {/* Nhóm 1: Đơn vị */}
        <FilterDropdown
          label="Đơn vị"
          value={selectedShowroom}
          options={[{value: 'all', label: '— Tất cả SR —'}, ...SHOWROOMS.map(sr => ({value: sr, label: sr}))]}
          onChange={setSelectedShowroom}
          width={140}
          placeholder="— Tất cả SR —"
        />
        <div className="toolbar-sep" style={{ height: 14 }} />
        {/* Nhóm 2: Thương hiệu */}
        <FilterDropdown
          label="Thương hiệu"
          value={selectedBrand}
          options={[{value: 'all', label: '— Tất cả —'}, ...visibleBrands.map(b => ({value: b.name, label: b.name}))]}
          onChange={(val: string) => { setSelectedBrand(val); setSelectedModels([]); }}
          width={120}
        />
        <div className="toolbar-sep" style={{ height: 14 }} />
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
        <div className="toolbar-sep" style={{ height: 14 }} />
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
              { value: 'prev_period', label: `Tháng trước (T${month === 1 ? 12 : month - 1}/${month === 1 ? year - 1 : year})` }
            ] : viewMode === 'quarter' ? [
              { value: 'prev_period', label: `Quý trước (Q${Math.ceil(month/3) === 1 ? 4 : Math.ceil(month/3) - 1})` }
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
                borderColor: hiddenChannels.has('DIGITAL') ? 'var(--color-border-dark)' : '#EA4335',
                background: hiddenChannels.has('DIGITAL') ? 'transparent' : '#EA433515',
                color: hiddenChannels.has('DIGITAL') ? 'var(--color-text-muted)' : '#EA4335',
                cursor: 'pointer', textDecoration: hiddenChannels.has('DIGITAL') ? 'line-through' : 'none',
              }}
            >
              Digital
            </button>
            {[{ cat: 'SỰ KIỆN', label: 'Sự kiện', color: '#10B981' }, { cat: 'CSKH', label: 'CSKH', color: '#F59E0B' }, { cat: 'NHẬN DIỆN', label: 'Nhận diện', color: '#8B5CF6' }].map(({ cat, label, color }) => (
              <button
                key={cat}
                onClick={() => toggleHiddenChannel(cat)}
                style={{
                  padding: '2px 8px', fontSize: 11, fontWeight: 600,
                  border: '1px solid', borderRadius: 4,
                  borderColor: hiddenChannels.has(cat) ? 'var(--color-border-dark)' : color,
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

          {/* Xem tổng hợp (chỉ đọc) — hiện khi đang ở aggregate view */}
          {pageMode === 'plan' && isAggregateView && (
            <>
              <div className="toolbar-sep" style={{ height: 14, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#64748b', padding: '0 4px', whiteSpace: 'nowrap', flexShrink: 0, fontStyle: 'italic' }}>Xem tổng hợp (chỉ đọc)</span>
            </>
          )}

        </div>



        {/* Spreadsheet Data Grid */}
        <div
          ref={scrollRef}
          className={cn("table-scroll-container", isScrolled && "scrolled")}
          onScroll={handleScroll}
        >
          <table className="data-table">
            <colgroup>
              <col style={{ width: COL1_WIDTH }} />
              <col style={{ width: COL2_WIDTH }} />
              {visibleChannels.flatMap((ch) =>
                visibleMetrics.flatMap((metric) =>
                  isActualSplitMode
                    ? [
                        <col key={`${ch.name}-${metric}-kh`} style={{ width: 70 }} />,
                        <col key={`${ch.name}-${metric}-th`} style={{ width: 70 }} />,
                      ]
                    : [<col key={`${ch.name}-${metric}`} style={{ width: metric === 'Ngân sách' ? 80 : 62 }} />]
                )
              )}
              {isActualSplitMode
                ? ['ns-kh','ns-th','khqt-kh','khqt-th','gdtd-kh','gdtd-th','khd-kh','khd-th'].map(k => <col key={`tot-${k}`} style={{ width: 70 }} />)
                : [88, 76, 76, 76].map((w, i) => <col key={`tot-${i}`} style={{ width: w }} />)
              }
            </colgroup>
            <thead>
              {/* Tier 1: Category Group Headers */}
              <tr style={{ height: 28 }}>
                <th
                  rowSpan={hasTier2 ? (isActualSplitMode ? 4 : 3) : (isActualSplitMode ? 3 : 2)}
                  style={{
                    ...stickyHeaderCol1, top: 0,
                    height: hasTier2 ? (isActualSplitMode ? 106 : 84) : (isActualSplitMode ? 78 : 56)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span>Thương hiệu</span>
                    <ChevronDown
                      size={12}
                      onClick={() => {
                        if (collapsedBrands.size === visibleBrands.length) {
                          setCollapsedBrands(new Set());
                        } else {
                          setCollapsedBrands(new Set(visibleBrands.map(b => b.name)));
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        color: 'var(--color-brand)',
                        opacity: 0.7,
                        transform: collapsedBrands.size === visibleBrands.length ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                        flexShrink: 0,
                      }}
                      aria-label={collapsedBrands.size === visibleBrands.length ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
                    />
                  </div>
                </th>
                <th
                  rowSpan={hasTier2 ? (isActualSplitMode ? 4 : 3) : (isActualSplitMode ? 3 : 2)}
                  style={{
                    ...stickyHeaderCol2, top: 0,
                    height: hasTier2 ? (isActualSplitMode ? 106 : 84) : (isActualSplitMode ? 78 : 56)
                  }}
                >
                  Dòng xe
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
                          position: 'sticky', top: 0, zIndex: 35,
                          textAlign: 'center',
                          background: '#eef2f7',
                          borderBottom: '1px solid var(--color-border-dark)',
                          borderTop: `3px solid ${catColor}`,
                          padding: '4px 8px'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                          {/* Digital: click tên để collapse/expand */}
                          {ch.category === 'DIGITAL' ? (
                            <span
                              onClick={() => setDigitalCollapsed(prev => !prev)}
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, color: catColor }}
                              title={digitalCollapsed ? 'Mở rộng kênh Digital' : 'Thu gọn kênh Digital'}
                            >
                              {ch.category}
                              <ChevronDown size={11} style={{ transform: digitalCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                            </span>
                          ) : (
                            ch.category
                          )}
                          <span 
                            onClick={() => {
                               if (pageMode === 'actual') return;
                               if (isDataLocked) {
                                 setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để phân bổ ngân sách.' });
                               } else {
                                 setAllocationModal({ open: true, type: 'category', name: ch.category });
                               }
                            }}
                            style={{ cursor: pageMode === 'actual' ? 'default' : 'pointer', opacity: pageMode === 'actual' ? 0.3 : 1, padding: '2px 3px', marginLeft: 2, borderRadius: 3, display: 'inline-flex', alignItems: 'center' }}
                            title={pageMode === 'actual' ? 'Phân bổ chỉ dùng trong KẾ HOẠCH' : 'Nhấn để phân bổ ngân sách hàng loạt cho nhóm kênh này'}
                          >
                            <Zap size={12} style={{ verticalAlign: 'text-bottom', color: catColor }} />
                          </span>
                        </span>
                      </th>
                    );
                  });
                })()}
                <th
                  colSpan={isActualSplitMode ? 8 : 4}
                  rowSpan={hasTier2 ? 2 : 1}
                  style={{
                    position: 'sticky', top: 0, zIndex: 35,
                    background: '#eef2f7',
                    color: 'var(--color-text)',
                    textAlign: 'center',
                    fontWeight: 700,
                    borderTop: '3px solid var(--color-text-muted)',
                    borderLeft: '2px solid var(--color-border-dark)',
                    borderBottom: '1px solid var(--color-border-dark)'
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

                  const color = ch.color;
                  return (
                    <th
                      key={`channel-${ch.name}`}
                      colSpan={visibleMetrics.length * (isActualSplitMode ? 2 : 1)}
                      style={{
                        position: 'sticky', top: 28, zIndex: 35,
                        textAlign: 'center',
                        background: '#eef2f7',
                        borderBottom: '1px solid var(--color-border-dark)',
                        color: 'var(--color-text)',
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
                                 setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để phân bổ ngân sách.' });
                               } else {
                                 setAllocationModal({ open: true, type: 'channel', name: ch.name });
                               }
                            }}
                            style={{ cursor: pageMode === 'actual' ? 'default' : 'pointer', opacity: pageMode === 'actual' ? 0.3 : 1, padding: '2px 3px', display: 'inline-flex', alignItems: 'center', borderRadius: 3 }}
                            title={pageMode === 'actual' ? 'Phân bổ chỉ dùng trong KẾ HOẠCH' : 'Nhấn để tăng/giảm ngân sách hàng loạt cho kênh này'}
                          >
                            <Zap size={12} />
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
                  const color = ch.color;
                  return visibleMetrics.map((metric) => (
                    <th
                      key={`${ch.name}-${metric}`}
                      colSpan={isActualSplitMode ? 2 : 1}
                      style={{
                        position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 35,
                        background: '#eef2f7',
                        color: 'var(--color-text-muted)',
                        width: isActualSplitMode ? 140 : (metric === 'Ngân sách' ? 80 : 62), minWidth: isActualSplitMode ? 140 : (metric === 'Ngân sách' ? 80 : 62),
                        textAlign: 'center',
                        fontSize: 'var(--fs-label)',
                        borderBottom: isActualSplitMode ? 'none' : '1px solid var(--color-border-dark)',
                        padding: '4px 8px'
                      }}
                    >
                      {metric === 'Ngân sách' ? 'NS' : metric}
                    </th>
                  ));
                })}
                <th colSpan={isActualSplitMode ? 2 : 1} style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 35, width: isActualSplitMode ? 140 : 88, minWidth: isActualSplitMode ? 140 : 88, background: '#eef2f7', color: 'var(--color-text)', textAlign: 'center', fontWeight: 600, borderBottom: isActualSplitMode ? 'none' : '1px solid var(--color-border-dark)', borderLeft: '2px solid var(--color-border-dark)', padding: '4px 8px' }}>Ngân sách</th>
                <th colSpan={isActualSplitMode ? 2 : 1} style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 35, width: isActualSplitMode ? 140 : 76, minWidth: isActualSplitMode ? 140 : 76, background: '#eef2f7', color: 'var(--color-text)', textAlign: 'center', fontWeight: 600, borderBottom: isActualSplitMode ? 'none' : '1px solid var(--color-border-dark)', borderLeft: '1px solid var(--color-border-dark)', padding: '4px 8px' }}>KHQT</th>
                <th colSpan={isActualSplitMode ? 2 : 1} style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 35, width: isActualSplitMode ? 140 : 76, minWidth: isActualSplitMode ? 140 : 76, background: '#eef2f7', color: 'var(--color-text)', textAlign: 'center', fontWeight: 600, borderBottom: isActualSplitMode ? 'none' : '1px solid var(--color-border-dark)', borderLeft: '1px solid var(--color-border-dark)', padding: '4px 8px' }}>GDTD</th>
                <th colSpan={isActualSplitMode ? 2 : 1} style={{ position: 'sticky', top: hasTier2 ? 56 : 28, zIndex: 35, width: isActualSplitMode ? 140 : 76, minWidth: isActualSplitMode ? 140 : 76, background: '#eef2f7', color: 'var(--color-text)', textAlign: 'center', fontWeight: 600, borderBottom: isActualSplitMode ? 'none' : '1px solid var(--color-border-dark)', borderLeft: '1px solid var(--color-border-dark)', padding: '4px 8px' }}>KHĐ</th>
              </tr>

              {/* Tier 4 (actual split mode only): KH | TH sub-headers per metric */}
              {isActualSplitMode && (
                <tr style={{ height: 22 }}>
                  {visibleChannels.map((ch) => {
                    const color = ch.color;
                    return visibleMetrics.map((metric) => (
                      <React.Fragment key={`${ch.name}-${metric}-split`}>
                        <th style={{
                          position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 35,
                          background: '#eef2f7',
                          width: 70, minWidth: 70, height: 22,
                          textAlign: 'center', fontSize: 'var(--fs-label)', fontWeight: 600,
                          color: '#64748b',
                          borderBottom: '2px solid var(--color-border-dark)',
                          borderRight: '1px dashed var(--color-border-dark)',
                          padding: '2px 4px'
                        }}>
                          KH
                        </th>
                        <th style={{
                          position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 35,
                          background: '#eef2f7',
                          width: 70, minWidth: 70, height: 22,
                          textAlign: 'center', fontSize: 'var(--fs-label)', fontWeight: 700,
                          color: '#0f172a',
                          borderBottom: '2px solid var(--color-border-dark)',
                          padding: '2px 4px'
                        }}>
                          TH
                        </th>
                      </React.Fragment>
                    ));
                  })}
                  {/* TỔNG CỘNG: KH | TH sub-headers */}
                  {['Ngân sách', 'KHQT', 'GDTD', 'KHĐ'].map((metric, idx) => (
                    <React.Fragment key={`total-split-${idx}`}>
                      <th style={{ position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 35, background: '#eef2f7', width: 70, minWidth: 70, height: 22, textAlign: 'center', fontSize: 'var(--fs-label)', fontWeight: 600, color: '#64748b', borderBottom: '2px solid var(--color-border-dark)', borderRight: '1px dashed var(--color-border-dark)', borderLeft: idx === 0 ? '2px solid var(--color-border-dark)' : '1px solid var(--color-border-dark)', padding: '2px 4px' }}>KH</th>
                      <th style={{ position: 'sticky', top: hasTier2 ? 84 : 56, zIndex: 35, background: '#eef2f7', width: 70, minWidth: 70, height: 22, textAlign: 'center', fontSize: 'var(--fs-label)', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid var(--color-border-dark)', padding: '2px 4px' }}>TH</th>
                    </React.Fragment>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>

              {visibleBrands.filter(b => selectedBrand === 'all' || b.name === selectedBrand).map((brand) => {
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
                // Ẩn toàn bộ brand nếu không có model nào hiển thị
                if (hideZeroRows && displayModels.length === 0) return null;
                return (
                  <React.Fragment key={brand.name}>
                    {/* Model rows — hidden when brand is collapsed */}
                    {!isCollapsed && displayModels.map((model, modelIdx) => {
                      let totalBudget = 0, histTotalBudget = 0;
                      let totalKhqt = 0, histTotalKhqt = 0;
                      let totalGdtd = 0, histTotalGdtd = 0;
                      let totalKhd = 0, histTotalKhd = 0;

                      let actTotalBudget = 0;
                      let actTotalKhqt = 0;
                      let actTotalGdtd = 0;
                      let actTotalKhd = 0;

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
                                <span style={{ fontSize: 8, color: 'var(--color-text-muted)', display: 'inline-block' }}>▼</span>
                                {brand.name}
                              </span>
                            </td>
                          )}
                          <td style={{ ...stickyBodyCol2, fontWeight: isComputedRow ? 700 : '500', background: isComputedRow ? '#f1f5f9' : '#ffffff', color: isComputedRow ? 'var(--color-brand)' : 'inherit', textTransform: isComputedRow ? 'uppercase' : 'none' }}>
                            {model}
                          </td>
                          {visibleChannels.map((ch) =>
                            visibleMetrics.map((metric) => {
                              const cellKey = `${brand.name}-${model}-${ch.name}-${metric}`;
                              const val = getCellValue(cellKey);
                              const histVal = getHistoricalValue(cellKey, compareMode);

                              let isHighCpl = false;
                              if (metric === 'Ngân sách' && val > 0) {
                                  const localKhqt = getCellValue(`${brand.name}-${model}-${ch.name}-KHQT`);
                                  if (localKhqt > 0 && (val / localKhqt) > 0.5) isHighCpl = true;
                              }
                              
                              if (ch.name !== 'Tổng Digital') {
                                const actualVal = (actualDataByMonth[month] || {})[cellKey] || 0;
                                if (metric === 'Ngân sách') {
                                  totalBudget += val;
                                  actTotalBudget += actualVal;
                                  if (histVal !== null) histTotalBudget += histVal;
                                }
                                if (metric === 'KHQT') {
                                  totalKhqt += val;
                                  actTotalKhqt += actualVal;
                                  if (histVal !== null) histTotalKhqt += histVal;
                                }
                                if (metric === 'GDTD') {
                                  totalGdtd += val;
                                  actTotalGdtd += actualVal;
                                  if (histVal !== null) histTotalGdtd += histVal;
                                }
                                if (metric === 'KHĐ') {
                                  totalKhd += val;
                                  actTotalKhd += actualVal;
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
                                    <td style={{ padding: 0, borderTop: '1px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)', borderLeft: '1px solid var(--color-border-dark)', borderRight: '1px dashed var(--color-border-dark)', height: 26, background: '#f8fafc' }}>
                                      <div style={{ padding: '2px 6px', textAlign: 'right', fontSize: 'var(--fs-table)', color: 'var(--color-text-muted)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {planVal > 0 ? formatNumber(planVal) : ''}
                                      </div>
                                    </td>
                                    {/* TH — Actual value: inline editable */}
                                    <td style={{ padding: 0, borderTop: '1px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)', borderLeft: 'none', borderRight: '1px solid var(--color-border-dark)', height: 26, background: actualVal > 0 ? '#fffbeb' : '#ffffff' }}>
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
                                <td key={cellKey} colSpan={isActualSplitMode ? 2 : 1} style={{ padding: 0, border: '1px solid #e2e8f0', height: compareMode !== 'none' ? 44 : 26 }}>
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
                                         // Click vào cell đang chọn → vào edit ngay (giống Excel)
                                         if (selectedCells.size === 1 && selectedCells.has(cellKey) && !isDataLocked) {
                                           e.preventDefault();
                                           setUndoStack(us => [...us.slice(-19), cellData]);
                                           setEditingCell(cellKey);
                                           setEditValue(String(getCellValue(cellKey) || ''));
                                           return;
                                         }
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
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      if (isDataLocked) {
                                        setAlertInfo({ type: 'warning', title: 'Chỉ xem tổng hợp', message: 'Vui lòng chọn một showroom cụ thể (không phải "Tất cả") để chỉnh sửa dữ liệu.' });
                                        return;
                                      }
                                      if (ch.readonly || isComputedRow) return;
                                      if (cellKey.includes('-Tổng Digital-') || isComputedRow) return;
                                      setUndoStack(us => [...us.slice(-19), cellData]); // Bug fix: dùng cellData (mode-aware) thay vì dataByMonth
                                      setEditingCell(cellKey);
                                      setEditValue(String(val || ''));
                                    }}
                                     style={(() => {
                                        const isOverBudget = pageMode === 'actual' && cellKey.endsWith('-Ngân sách') && val > 0 && (planCellData[cellKey] || 0) > 0 && val > (planCellData[cellKey] || 0) * 1.1;
                                        return {
                                          height: '100%', position: 'relative' as const,
                                          background: isOverBudget ? '#fff5f5' : ((ch.readonly || isComputedRow) ? '#f1f5f9' : (isHighCpl ? '#fef08a' : (selectedCells.has(cellKey) ? '#e0f2fe' : 'transparent'))),
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
                          {(() => {
                             const totals = [
                               { key: 'budget', val: totalBudget, act: actTotalBudget, hist: histTotalBudget },
                               { key: 'khqt', val: totalKhqt, act: actTotalKhqt, hist: histTotalKhqt },
                               { key: 'gdtd', val: totalGdtd, act: actTotalGdtd, hist: histTotalGdtd },
                               { key: 'khd', val: totalKhd, act: actTotalKhd, hist: histTotalKhd }
                             ];
                             return totals.map((t, idx) => {
                               const bg = isComputedRow ? '#e2e8f0' : (idx === 0 ? '#f1f5f9' : '#f8fafc');
                               const color = idx === 0 || isComputedRow ? 'var(--color-text)' : 'inherit';
                               const fw = idx === 0 || isComputedRow ? 700 : 600;
                               if (isActualSplitMode) {
                                 return (
                                    <React.Fragment key={`tot-${t.key}`}>
                                      <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 600, background: '#f8fafc', color: 'var(--color-text-muted)', borderRight: '1px dashed var(--color-border-dark)', borderLeft: idx === 0 ? '2px solid var(--color-border-dark)' : '1px solid var(--color-border-dark)' }}>
                                        {t.val > 0 ? formatNumber(t.val) : ''}
                                      </td>
                                      <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: fw, background: bg, color: color }}>
                                        {t.act > 0 ? formatNumber(t.act) : ''}
                                      </td>
                                    </React.Fragment>
                                 );
                               }
                               return (
                                 <td key={`tot-${t.key}`} style={{ textAlign: 'right', fontWeight: fw, background: bg, color: color, borderLeft: idx === 0 ? '2px solid var(--color-border-dark)' : '1px solid var(--color-border-dark)' }}>
                                   {renderDualValue(t.val, compareMode !== 'none' ? t.hist : null, false)}
                                 </td>
                               );
                             });
                          })()}
                        </tr>
                      );
                    })}

                    {/* Brand Subtotal Row — always visible, click to toggle */}
                    <tr className="subtotal">
                      <td
                        style={{ ...stickyBodyCol1, background: isCollapsed ? '#e2e8f0' : '#f1f5f9', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggleBrand(brand.name)}
                        title={(isCollapsed || displayModels.length === 0) ? `Mở rộng ${brand.name}` : `Thu gọn ${brand.name}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <span style={{
                            fontSize: 8,
                            color: 'var(--color-text-muted)',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}>{(isCollapsed || displayModels.length === 0) ? '▶' : '▼'}</span>
                          {brand.name}
                        </span>
                      </td>
                      <td style={{ ...stickyBodyCol2, background: isCollapsed ? '#e2e8f0' : '#f1f5f9', fontWeight: 700, fontSize: 'var(--fs-table)', color: 'var(--color-text)' }}>
                        Σ {brand.name}
                      </td>
                      {visibleChannels.map((ch) =>
                        visibleMetrics.map((metric) => (
                          <td
                            key={`sub-${brand.name}-${ch.name}-${metric}`}
                            colSpan={isActualSplitMode ? 2 : 1}
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              background: isCollapsed ? '#e2e8f0' : '#f1f5f9',
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
                      <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 700, background: '#e2e8f0', color: 'var(--color-text)', borderLeft: '2px solid var(--color-border-dark)' }}>
                        {renderDualValue(subtotal.budget, compareMode !== 'none' ? subtotal.histBudget : null, false)}
                      </td>
                      <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 600, background: '#f1f5f9', borderLeft: '1px solid var(--color-border-dark)' }}>
                        {renderDualValue(subtotal.khqt, compareMode !== 'none' ? subtotal.histKhqt : null, false)}
                      </td>
                      <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 600, background: '#f1f5f9', borderLeft: '1px solid var(--color-border-dark)' }}>
                        {renderDualValue(subtotal.gdtd, compareMode !== 'none' ? subtotal.histGdtd : null, false)}
                      </td>
                      <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 600, background: '#f1f5f9', borderLeft: '1px solid var(--color-border-dark)' }}>
                        {renderDualValue(subtotal.khd, compareMode !== 'none' ? subtotal.histKhd : null, false)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Grand Total Row */}
              <tr className="grand-total">
                <td style={{ ...stickyBodyCol1, background: '#f1f5f9', fontWeight: 800, color: 'var(--color-text)', borderTop: '2px solid var(--color-text-muted)' }}>
                  TỔNG
                </td>
                <td style={{ ...stickyBodyCol2, background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid var(--color-text-muted)', color: 'var(--color-text)' }}>
                  TOÀN BỘ
                </td>
                {visibleChannels.map((ch) =>
                  visibleMetrics.map((metric) => (
                    <td
                      key={`grand-${ch.name}-${metric}`}
                      colSpan={isActualSplitMode ? 2 : 1}
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: 'var(--fs-table)',
                        background: ch.readonly ? '#f8fafc' : undefined,
                        borderTop: '2px solid var(--color-text-muted)'
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
                <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 800, background: '#e2e8f0', color: 'var(--color-text)', fontSize: 12, borderTop: '2px solid var(--color-text-muted)', borderLeft: '2px solid var(--color-border-dark)' }}>
                  {renderDualValue(grandTotal.budget, compareMode !== 'none' ? grandTotal.histBudget : null, false)}
                </td>
                <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 700, background: '#f1f5f9', color: 'var(--color-text)', borderTop: '2px solid var(--color-text-muted)', borderLeft: '1px solid var(--color-border-dark)' }}>
                  {renderDualValue(grandTotal.khqt, compareMode !== 'none' ? grandTotal.histKhqt : null, false)}
                </td>
                <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 700, background: '#f1f5f9', color: 'var(--color-text)', borderTop: '2px solid var(--color-text-muted)', borderLeft: '1px solid var(--color-border-dark)' }}>
                  {renderDualValue(grandTotal.gdtd, compareMode !== 'none' ? grandTotal.histGdtd : null, false)}
                </td>
                <td colSpan={isActualSplitMode ? 2 : 1} style={{ textAlign: 'right', fontWeight: 700, background: '#f1f5f9', color: 'var(--color-text)', borderTop: '2px solid var(--color-text-muted)', borderLeft: '1px solid var(--color-border-dark)' }}>
                  {renderDualValue(grandTotal.khd, compareMode !== 'none' ? grandTotal.histKhd : null, false)}
                </td>
              </tr>

            </tbody>

            {/* ─── BẢNG THEO SHOWROOM — cùng <table> để cột thẳng hàng ─── */}
            {(() => {
              const displaySRs = isAggregateView
                ? showrooms.filter(s => !s.id.startsWith('fallback'))
                : showrooms.filter(s => s.name === selectedShowroom);
              if (displaySRs.length === 0) return null;

              return (
                <tbody>
                  {/* Section label row */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{ padding: '5px 8px 3px', borderTop: '3px solid var(--color-border-dark)', background: '#f8fafc', position: 'sticky', left: 0, zIndex: 5, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', minWidth: COL1_WIDTH + COL2_WIDTH }}
                    >
                      {isAggregateView ? 'Chi tiết theo Showroom' : `Tổng hợp — ${selectedShowroom}`}
                    </td>
                    <td colSpan={999} style={{ borderTop: '3px solid var(--color-border-dark)', background: '#f8fafc' }} />
                  </tr>
                  {/* Sub-header row */}
                  <tr style={{ height: 24 }}>
                    <td colSpan={2} style={{ padding: '2px 8px', background: '#eef2f7', position: 'sticky', left: 0, zIndex: 5, fontWeight: 600, fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-dark)', minWidth: COL1_WIDTH + COL2_WIDTH }}>
                      Đơn vị
                    </td>
                    {visibleChannels.map(ch => visibleMetrics.map(m => (
                      <td key={`sr-hdr-${ch.name}-${m}`} colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 6px', background: '#eef2f7', textAlign: 'center', fontSize: 'var(--fs-label)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-dark)' }}>
                        {m === 'Ngân sách' ? 'NS' : m}
                      </td>
                    )))}
                    <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', background: '#eef2f7', textAlign: 'center', fontWeight: 600, fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)', borderLeft: '2px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)' }}>NS</td>
                    <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', background: '#eef2f7', textAlign: 'center', fontWeight: 600, fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)', borderLeft: '1px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)' }}>KHQT</td>
                    <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', background: '#eef2f7', textAlign: 'center', fontWeight: 600, fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)', borderLeft: '1px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)' }}>GDTD</td>
                    <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', background: '#eef2f7', textAlign: 'center', fontWeight: 600, fontSize: 'var(--fs-label)', color: 'var(--color-text-secondary)', borderLeft: '1px solid var(--color-border-dark)', borderBottom: '1px solid var(--color-border-dark)' }}>KHĐ</td>
                  </tr>
                  {displaySRs.map((srObj, si) => {
                    const srData = (pageMode === 'plan' ? showroomDataByMonth : showroomActualDataByMonth)[month]?.[srObj.id] || {};
                    const bg = si % 2 === 0 ? '#ffffff' : '#fafafa';

                    // Tổng theo channel+metric từ legacy keys (brand-model-channel-metric)
                    const getChMetricSum = (chName: string, metric: string) => {
                      let sum = 0;
                      const suffix = `-${chName}-${metric}`;
                      for (const [k, v] of Object.entries(srData)) {
                        if (k.endsWith(suffix)) sum += (v as number) || 0;
                      }
                      return sum;
                    };
                    // Tổng Digital = sum tất cả kênh digital
                    const getChanSum = (ch: typeof visibleChannels[0], metric: string) =>
                      ch.isAggregate
                        ? digitalChannelNames.reduce((s, dcName) => s + getChMetricSum(dcName, metric), 0)
                        : getChMetricSum(ch.name, metric);

                    // Pre-compute summary totals (chỉ kênh thực, không tính Tổng Digital)
                    let totalNS = 0, totalKHQT = 0, totalGDTD = 0, totalKHD = 0;
                    visibleChannels.filter(ch => !ch.isAggregate).forEach(ch => {
                      totalNS   += getChanSum(ch, 'Ngân sách');
                      totalKHQT += getChanSum(ch, 'KHQT');
                      totalGDTD += getChanSum(ch, 'GDTD');
                      totalKHD  += getChanSum(ch, 'KHĐ');
                    });

                    // Áp dụng filter ẩn dòng trống — nhất quán với bảng brand
                    if (hideZeroRows && totalNS === 0 && totalKHQT === 0 && totalGDTD === 0 && totalKHD === 0) return null;

                    return (
                      <tr key={srObj.id} style={{ background: bg, height: 26 }}>
                        {/* Showroom name — span cả 2 sticky cols để thẳng hàng */}
                        <td
                          colSpan={2}
                          style={{ padding: '2px 8px', fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', position: 'sticky', left: 0, background: bg, zIndex: 5, minWidth: COL1_WIDTH + COL2_WIDTH }}
                        >
                          {srObj.name}
                        </td>
                        {/* Data cells — cùng visibleChannels × visibleMetrics như bảng trên */}
                        {visibleChannels.map(ch => visibleMetrics.map(m => {
                          const v = getChanSum(ch, m);
                          return (
                            <td
                              key={`sr-${srObj.id}-${ch.name}-${m}`}
                              colSpan={isActualSplitMode ? 2 : 1}
                              style={{ padding: '2px 6px', textAlign: 'right', borderBottom: '1px solid var(--color-border)', background: ch.readonly ? (si % 2 === 0 ? '#fafafa' : '#f5f5f5') : undefined, color: v > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                            >
                              {v > 0 ? formatNumber(v) : '—'}
                            </td>
                          );
                        }))}
                        {/* Summary cols — khớp với TỔNG CỘNG của bảng trên */}
                        <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 700, background: '#f1f5f9', borderBottom: '1px solid var(--color-border)', borderLeft: '2px solid var(--color-border-dark)', color: totalNS > 0 ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
                          {totalNS > 0 ? formatNumber(totalNS) : '—'}
                        </td>
                        <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 600, background: '#f8fafc', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border-dark)', color: totalKHQT > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {totalKHQT > 0 ? formatNumber(totalKHQT) : '—'}
                        </td>
                        <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 600, background: '#f8fafc', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border-dark)', color: totalGDTD > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {totalGDTD > 0 ? formatNumber(totalGDTD) : '—'}
                        </td>
                        <td colSpan={isActualSplitMode ? 2 : 1} style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 600, background: '#f8fafc', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border-dark)', color: totalKHD > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {totalKHD > 0 ? formatNumber(totalKHD) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })()}
          </table>

          {/* SỰ KIỆN — Read-only summary, quản lý tại trang Quản trị sự kiện */}
          <div style={{ marginTop: 20, borderTop: '2px solid var(--color-border-dark)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {/* Left: title + stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={15} style={{ color: '#10B981' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Sự kiện tháng {month}
                  </span>
                </div>
                {/* Stats pills */}
                {(() => {
                  const evs = events.filter(ev =>
                    selectedShowroom === 'all' ? true : ev.showroom === selectedShowroom
                  );
                  const totalBudget = evs.reduce((s, e) => s + (e.budget || 0), 0);
                  const totalLeads  = evs.reduce((s, e) => s + (e.leads  || 0), 0);
                  const totalDeals  = evs.reduce((s, e) => s + (e.deals  || 0), 0);
                  if (evs.length === 0) return (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Chưa có sự kiện nào được lập kế hoạch
                    </span>
                  );
                  return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ padding: '2px 8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#059669' }}>
                        {evs.length} sự kiện
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        NS: <strong style={{ color: 'var(--color-brand)' }}>{formatNumber(totalBudget)} tr</strong>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        KHQT: <strong style={{ color: '#3b82f6' }}>{formatNumber(totalLeads)}</strong>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        KHĐ: <strong style={{ color: '#10b981' }}>{formatNumber(totalDeals)}</strong>
                      </span>
                      {/* Mini event list */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 400 }}>
                        {evs.slice(0, 4).map(ev => (
                          <span key={ev.id} style={{
                            fontSize: 10, padding: '1px 7px', borderRadius: 10,
                            background: ev.status === 'completed' ? '#f0fdf4' : ev.status === 'overdue' ? '#fef2f2' : '#eff6ff',
                            color: ev.status === 'completed' ? '#059669' : ev.status === 'overdue' ? '#dc2626' : '#2563eb',
                            border: `1px solid ${ev.status === 'completed' ? '#86efac' : ev.status === 'overdue' ? '#fecaca' : '#93c5fd'}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {ev.name.length > 20 ? ev.name.slice(0, 20) + '…' : ev.name}
                          </span>
                        ))}
                        {evs.length > 4 && (
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            +{evs.length - 4} khác
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Right: link button */}
              <a
                href={`/events?month=${month}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 7,
                  background: '#eff6ff', border: '1px solid #93c5fd',
                  color: '#1d4ed8', fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dbeafe'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
              >
                <CalendarDays size={13} />
                Quản trị sự kiện →
              </a>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-bar-item">
            Dữ liệu kỳ: Tháng {String(month).padStart(2, '0')}/{year} | {visibleBrands.reduce((s, b) => s + b.models.filter(m => !m.startsWith('Tổng ')).length, 0)} dòng xe
          </div>
          {/* KPI Summary — thay thế các mục cũ */}
          <div className="status-bar-item" style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: 'auto', paddingLeft: 0, borderLeft: 'none' }}>
            <div className="summary-chip">
              <Wallet size={11} style={{ color: 'var(--color-brand)', opacity: 0.7 }} />
              <span className="summary-chip-label">Tổng NS</span>
              <span className="summary-chip-value" style={{ color: 'var(--color-brand)', fontSize: 11 }}>
                {summary.budget > 0 ? formatNumber(summary.budget) : '—'} <span className="summary-chip-unit">tr</span>
              </span>
            </div>
            <div className="summary-divider" />
            <div className="summary-chip">
              <Users size={11} style={{ color: '#3B82F6', opacity: 0.7 }} />
              <span className="summary-chip-label">KHQT</span>
              <span className="summary-chip-value" style={{ color: '#3B82F6', fontSize: 11 }}>
                {summary.khqt > 0 ? formatNumber(summary.khqt) : '—'}
              </span>
            </div>
            <div className="summary-divider" />
            <div className="summary-chip">
              <BarChart3 size={11} style={{ color: '#F59E0B', opacity: 0.7 }} />
              <span className="summary-chip-label">GDTD</span>
              <span className="summary-chip-value" style={{ color: '#F59E0B', fontSize: 11 }}>
                {summary.gdtd > 0 ? formatNumber(summary.gdtd) : '—'}
              </span>
            </div>
            <div className="summary-divider" />
            <div className="summary-chip">
              <FileSignature size={11} style={{ color: '#10B981', opacity: 0.7 }} />
              <span className="summary-chip-label">KHĐ</span>
              <span className="summary-chip-value" style={{ color: '#10B981', fontSize: 11 }}>
                {summary.khd > 0 ? formatNumber(summary.khd) : '—'}
              </span>
            </div>
            <div className="summary-divider" />
            <div className="summary-chip">
              <span className="summary-chip-label">CPL</span>
              <span className="summary-chip-value" style={{ color: summary.cpl !== null ? '#8B5CF6' : 'var(--color-text-muted)', fontSize: 11 }}>
                {summary.cpl !== null ? summary.cpl.toFixed(1) : '—'} <span className="summary-chip-unit">tr/lead</span>
              </span>
            </div>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
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
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
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

