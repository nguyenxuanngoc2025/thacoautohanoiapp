/**
 * events-data.ts — Layer I/O cho dữ liệu sự kiện marketing
 *
 * SINGLE SOURCE OF TRUTH: Supabase DB (thaco_events + thaco_budget_plans)
 * Tất cả đọc/ghi đều qua API Routes server-side để bypass RLS.
 * KHÔNG dùng hardcode danh mục brand/model — dữ liệu từ thaco_master_brands/models.
 */

// ─── Shared Types ──────────────────────────────────────────────────────────────

/** EventItem: dùng đúng cấu trúc này cho cả planning và events dashboard */
export interface EventItem {
  id: number;
  unit_id?: string;
  /**
   * Mã showroom (ví dụ 'PVD'). Phase 1 Bottom-Up: runtime enforce NOT NULL khi upsert.
   * Type-level optional để backward-compat với seed data cũ.
   */
  showroom_code?: string;
  /** Tên hiển thị showroom (legacy — sẽ migrate sau). */
  showroom: string;
  name: string;
  type: string;
  date: string;
  location: string;
  brands: string[];       // mixed brand names + model names (như planning page)
  budget: number;         // triệu VND — KH Ngân sách
  leads?: number;         // KHQT — kế hoạch khách quan tâm
  gdtd?: number;          // GDTD — gặp gỡ tiếp xúc dự kiến
  deals?: number;         // KHĐ — kế hoạch hợp đồng
  testDrives?: number;    // Số lượt lái thử kế hoạch
  // ── Kết quả thực tế (điền sau khi kết thúc) ──
  endDate?: string;
  budgetSpent?: number;   // Ngân sách thực chi
  leadsActual?: number;   // KHQT thực tế
  gdtdActual?: number;    // GDTD thực tế
  dealsActual?: number;   // KHĐ thực tế
  testDrivesActual?: number; // Lái thử thực tế
  status?: EventStatus;
  priority?: EventPriority;
  owner?: string;
  notes?: string;
  reportLink?: string; // Link đến báo cáo chi tiết (Google Drive, vv)
}

export type EventStatus = 'completed' | 'in_progress' | 'upcoming' | 'overdue';
export type EventPriority = 'high' | 'medium' | 'low';
export type EventsByMonth = Record<number, EventItem[]>;

// ─── Config / Display Maps ─────────────────────────────────────────────────────

export const EVENT_TYPE_COLORS: Record<string, string> = {
  'Lái thử': '#3B82F6',
  'Trưng bày': '#8B5CF6',
  'Ra mắt sản phẩm': '#EC4899',
  'Sự kiện KH': '#10B981',
  'Workshop': '#F59E0B',
  'Roadshow': '#06B6D4',
};

export const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Hoàn thành',   color: '#059669', bg: '#ecfdf5' },
  in_progress: { label: 'Đang diễn ra', color: '#2563eb', bg: '#eff6ff' },
  upcoming:    { label: 'Sắp tới',      color: '#d97706', bg: '#fffbeb' },
  overdue:     { label: 'Quá hạn',      color: '#dc2626', bg: '#fef2f2' },
};

export const PRIORITY_CONFIG: Record<EventPriority, { label: string; color: string; dot: string }> = {
  high:   { label: 'Cao',        color: '#dc2626', dot: '#ef4444' },
  medium: { label: 'Trung bình', color: '#d97706', dot: '#f59e0b' },
  low:    { label: 'Thấp',       color: '#6b7280', dot: '#9ca3af' },
};

// ─── Helpers: parse month/year từ event date (internal) ────────────────────────

import { createClient } from '@/lib/supabase/client';
import { mutate as swrMutate } from 'swr';

// ─── Supabase I/O ──────────────────────────────────────────────────────────────

/**
 * Đọc events từ Supabase. Nếu trống → trả về SEED_EVENTS_BY_MONTH.
 */
export async function fetchEventsFromDB(unit_id?: string): Promise<EventsByMonth> {
  // Helper: trả về object 12 tháng đều rỗng — KHÔNG fallback về SEED mock data
  const emptyMonths = (): EventsByMonth => {
    const e: EventsByMonth = {};
    for (let i = 1; i <= 12; i++) e[i] = [];
    return e;
  };

  if (typeof window === 'undefined') return emptyMonths();
  const supabase = createClient();
  let query = supabase.from('thaco_events').select('*');

  if (unit_id && unit_id !== 'all') {
    // Include events belonging to the unit OR events with no unit set (legacy/global)
    query = query.or(`unit_id.eq.${unit_id},unit_id.is.null`);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) return emptyMonths();

  // Khởi tạo 12 tháng rỗng rồi điền từ DB
  const merged: EventsByMonth = emptyMonths();

  data.forEach((row) => {
    let month = 1;
    if (row.date) {
      if (row.date.includes('/')) month = parseInt(row.date.split('/')[1]);
      else month = parseInt(row.date.split('-')[1]);
    }

    const ev: EventItem = {
      id: Number(row.id),
      unit_id: row.unit_id,
      showroom_code: row.showroom_code || row.showroom || '',
      showroom: row.showroom || '',
      name: row.name || '',
      type: row.type || '',
      date: row.date || '',
      location: row.location || '',
      brands: row.brands || [],
      budget: Number(row.budget) || 0,
      leads: row.leads,
      gdtd: row.gdtd,
      deals: row.deals,
      testDrives: row.test_drives,
      endDate: row.end_date,
      budgetSpent: row.budget_spent,
      leadsActual: row.leads_actual,
      gdtdActual: row.gdtd_actual,
      dealsActual: row.deals_actual,
      testDrivesActual: row.test_drives_actual,
      status: row.status,
      priority: row.priority,
      owner: row.owner,
      notes: row.notes,
      reportLink: row.report_link
    };
    if (merged[month]) {
      merged[month].push(ev);
    }
  });

  return merged;
}

/**
 * Ghi event vào Supabase (insert hoặc update).
 */
export async function upsertEventToDB(ev: EventItem): Promise<void> {
  if (typeof window === 'undefined') throw new Error('upsertEventToDB chỉ chạy phía client');

  // showroom_code bắt buộc
  if (!ev.showroom_code || ev.showroom_code === 'ALL' || ev.showroom_code === 'all') {
    throw new Error(`showroom_code không hợp lệ: "${ev.showroom_code || '(rỗng)'}"`);
  }

  const supabase = createClient();

  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout at: ${label} sau ${ms}ms`)), ms))
    ]);
  };

  let resolvedUnitId = ev.unit_id;
  if (!resolvedUnitId || resolvedUnitId === 'all') {
    // Lookup unit_id từ showroom_code trong DB
    try {
      const result = await withTimeout<{ data: { unit_id: string } | null; error: unknown }>(
        supabase.from('thaco_showrooms').select('unit_id').eq('code', ev.showroom_code).single() as any,
        8000,
        'Lookup showroom unit_id'
      );
      if (result?.data?.unit_id) resolvedUnitId = result.data.unit_id;
    } catch (e: any) {
      console.warn('Lỗi lookup unit_id:', e);
      // Tiếp tục dù lỗi lookup để không block flow, sẽ retry nếu cần
    }
  }

  const payload: Record<string, unknown> = {
    id: ev.id,
    showroom_code: ev.showroom_code,
    showroom: ev.showroom || ev.showroom_code,
    name: ev.name,
    type: ev.type,
    date: ev.date,
    location: ev.location,
    brands: ev.brands,
    budget: ev.budget,
    leads: ev.leads ?? null,
    gdtd: ev.gdtd ?? null,
    deals: ev.deals ?? null,
    test_drives: ev.testDrives ?? null,
    end_date: ev.endDate ?? null,
    budget_spent: ev.budgetSpent ?? null,
    leads_actual: ev.leadsActual ?? null,
    gdtd_actual: ev.gdtdActual ?? null,
    deals_actual: ev.dealsActual ?? null,
    test_drives_actual: ev.testDrivesActual ?? null,
    status: ev.status ?? null,
    priority: ev.priority ?? null,
    owner: ev.owner ?? null,
    notes: ev.notes ?? null,
  };
  if (resolvedUnitId && resolvedUnitId !== 'all') payload.unit_id = resolvedUnitId;

  console.log('[upsertEventToDB] Đang gửi payload lên Supabase:', payload);
  try {
    const res = await withTimeout(
      fetch('/api/events/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      15000,
      'API /api/events/upsert'
    );
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.error("Lỗi khi lưu thaco_events (API):", err);
    throw new Error(err.message || 'Lỗi không xác định khi lưu qua API');
  }

  // Sync vào budget_entries trong background (không await → không block UI)
  const eventMonth = parseEventMonth(ev.date);
  const eventYear = parseEventYear(ev.date);
  if (eventMonth && eventYear) {
    syncEventsToBudgetPlan(ev.showroom_code, eventMonth, eventYear, resolvedUnitId)
      .then(() => {
        // Invalidate SWR cache của planning page để thấy data event mới
        swrMutate(
          (key: unknown) => Array.isArray(key) && key[0] === 'budget_entries',
          undefined,
          { revalidate: true }
        );
        // Cũng invalidate view caches (dashboard/reports)
        swrMutate(
          (key: unknown) => Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('v_budget'),
          undefined,
          { revalidate: true }
        );
      })
      .catch(err => console.warn('[upsertEventToDB] sync background failed:', err));
  }
}

/**
 * Xóa event khỏi Supabase.
 */
export async function deleteEventFromDB(id: number, showroom_code: string, date: string): Promise<void> {
  if (typeof window === 'undefined') throw new Error('deleteEventFromDB chỉ chạy phía client');
  
  const payload = { id };
  try {
    const res = await Promise.race([
      fetch('/api/events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout API Delete')), 15000))
    ]);
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.error("Lỗi khi xóa sự kiện (API):", err);
    throw new Error(err.message || 'Lỗi không xác định khi xóa qua API');
  }

  // Trigger sync ngầm để tính toán lại ngân sách sau khi xóa event
  const eventMonth = parseEventMonth(date);
  const eventYear = parseEventYear(date);
  if (eventMonth && eventYear) {
    syncEventsToBudgetPlan(showroom_code, eventMonth, eventYear)
      .then(() => {
        swrMutate(
          (key: unknown) => Array.isArray(key) && key[0] === 'budget_entries',
          undefined,
          { revalidate: true }
        );
        swrMutate(
          (key: unknown) => Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('v_budget'),
          undefined,
          { revalidate: true }
        );
      })
      .catch(err => console.warn('[deleteEventFromDB] sync background failed:', err));
  }
}

function parseEventMonth(dateStr: string): number | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) return parseInt(dateStr.split('/')[1]) || null;
  if (dateStr.includes('-')) return parseInt(dateStr.split('-')[1]) || null;
  return null;
}
function parseEventYear(dateStr: string): number | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) return parseInt(dateStr.split('/')[2]) || null;
  if (dateStr.includes('-')) return parseInt(dateStr.split('-')[0]) || null;
  return null;
}

/**
 * Sync TẤT CẢ events của 1 showroom+month vào thaco_budget_plans.
 *
 * Payload key format: BRAND-MODEL-Sự kiện-METRIC
 * (BRAND = phần tử đầu trong brands[], MODEL = phần tử thứ 2, hoặc brand nếu chỉ có 1)
 *
 * Logic:
 * 1. Fetch ALL events cho showroom_code + month + year
 * 2. Aggregate thành payload keys (cùng brand-model → SUM)
 * 3. Fetch existing budget_plan → remove tất cả cũ -Sự kiện- keys
 * 4. Merge payload mới → upsert budget_plan
 */
/**
 * [OLD] Logic sync cũ. Giờ chuyển sang gọi API server-side để bypass RLS
 */
export async function syncEventsToBudgetPlan(
  showroomCode: string,
  month: number,
  year: number = 2026,
  unitId?: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  const payload = { showroom_code: showroomCode, month, year, unit_id: unitId };

  try {
    const res = await Promise.race([
      fetch('/api/events/sync-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout API Sync')), 20000))
    ]);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    console.log(`[syncEventsToBudgetPlan] ✅ Gửi lệnh sync thành công (${showroomCode}, T${month}/${year})`);
  } catch (err) {
    console.warn('[syncEventsToBudgetPlan] Lỗi API sync-budget:', err);
  }
}


export function inferEventStatus(event: EventItem, today?: Date): EventStatus {
  if (event.status === 'completed') return 'completed';

  const t = today || new Date();
  t.setHours(0, 0, 0, 0);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(t);
    let pd = new Date(t);
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) pd = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) pd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    pd.setHours(0, 0, 0, 0);
    return pd;
  };

  const startD = parseDate(event.date);
  const diffStart = Math.round((startD.getTime() - t.getTime()) / (86400000));

  if (diffStart > 0) return 'upcoming';

  if (event.endDate) {
    const endD = parseDate(event.endDate);
    const diffEnd = Math.round((endD.getTime() - t.getTime()) / (86400000));
    
    if (diffEnd < 0) return 'overdue';
    if (diffStart <= 0 && diffEnd >= 0) return 'in_progress';
  } else {
    if (diffStart < 0) return 'overdue';
    if (diffStart === 0) return 'in_progress';
  }

  return event.status || 'upcoming';
}

// ─── Shared Constants & Helpers ───────────────────────────────

export const EVENT_TYPES = ['Lái thử', 'Trưng bày', 'Sự kiện KH', 'Ra mắt sản phẩm', 'Workshop', 'Roadshow'];
export const PRIORITIES: EventPriority[] = ['high', 'medium', 'low'];

import { DEMO_KPI_RATES } from './master-data';

/**
 * Tạo payload keys cho budget_plans từ event brands/models.
 * SSOT: dùng dbBrands từ DB (thaco_master_brands + thaco_master_models).
 * KHÔNG dùng MASTER_BRANDS hardcode.
 *
 * @param evBrands     - brands[] được chọn trên form (mixed brand names + model names)
 * @param budget/leads/gdtd/deals - giá trị KPI của event
 * @param dbBrands     - danh sách brand+model từ DB (qua BrandsContext hoặc fetch trực tiếp)
 */
export function buildEventPayloadKeys(
  evBrands: string[],
  budget: number,
  leads: number,
  gdtd: number,
  deals: number,
  dbBrands: { name: string; models: string[]; modelData?: { name: string; is_aggregate?: boolean | null; aggregate_group?: string | null }[] }[]
): Record<string, number> {
  const payload: Record<string, number> = {};
  const selectedBrandNames = new Set(
    dbBrands
      .map((brand) => brand.name)
      .filter((brandName) => evBrands.includes(brandName) && !/^DVPT\b/i.test(brandName))
  );

  const explicitTargets = dbBrands.flatMap((brand) => {
    if (!selectedBrandNames.has(brand.name)) return [];

    const selectableModels = (brand.modelData ?? brand.models.map((name) => ({ name, is_aggregate: false, aggregate_group: null })))
      .filter((model) => !model.is_aggregate)
      .filter((model) => !(model.aggregate_group === 'TONG' && /^DVPT\b/i.test(brand.name)))
      .map((model) => model.name);

    const explicitlySelected = selectableModels.filter((model) => evBrands.includes(model));
    
    // Fallback: If brand is selected but no specific models, assume ALL models
    if (explicitlySelected.length === 0) {
      // If brand has no non-aggregate models (rare edge case), use standard empty
      if (selectableModels.length === 0) return [{ brand: brand.name, model: brand.name }];
      return selectableModels.map((model) => ({ brand: brand.name, model }));
    }

    return explicitlySelected.map((model) => ({ brand: brand.name, model }));
  });

  if (explicitTargets.length === 0) {
    return payload;
  }

  const fraction = 1 / explicitTargets.length;

  for (const target of explicitTargets) {
    const prefix = `${target.brand}-${target.model}-Sự kiện`;
    payload[`${prefix}-Ngân sách`] = (payload[`${prefix}-Ngân sách`] || 0) + budget * fraction;
    payload[`${prefix}-KHQT`]      = (payload[`${prefix}-KHQT`]      || 0) + leads  * fraction;
    payload[`${prefix}-GDTD`]      = (payload[`${prefix}-GDTD`]      || 0) + gdtd   * fraction;
    payload[`${prefix}-KHĐ`]       = (payload[`${prefix}-KHĐ`]       || 0) + deals  * fraction;
  }
  return payload;
}

// ─── Centralized Constants (Single Source of Truth) ───────────────────────────
/** Chi phí trên mỗi lead (triệu VND) — Cost Per Lead */
export const EVENT_CPL = DEMO_KPI_RATES.EVENT_CPL;
/** Conversion Rate: Leads → GDTD (Gặp gỡ tiếp xúc dự kiến) */
export const EVENT_CR1 = DEMO_KPI_RATES.EVENT_CR1;
/** Conversion Rate: GDTD → KHĐ (Kế hoạch hợp đồng) */
export const EVENT_CR2 = DEMO_KPI_RATES.EVENT_CR2;

export function deriveKpis(budget: number) {
  return {
    leads: Math.round(budget / EVENT_CPL),
    gdtd:  Math.round((budget / EVENT_CPL) * EVENT_CR1),
    deals: Math.round((budget / EVENT_CPL) * EVENT_CR1 * EVENT_CR2),
  };
}

export function emptyEvent(month: number, defaultShowroomCode: string, defaultShowroomName?: string): EventItem {
  const mm = String(month).padStart(2, '0');
  return {
    id: Date.now(),
    name: '', type: 'Lái thử',
    showroom_code: defaultShowroomCode,
    showroom: defaultShowroomName || defaultShowroomCode,
    date: `01/${mm}/2026`, location: '',
    brands: [], budget: 0,
    leads: 0, gdtd: 0, deals: 0, testDrives: 0,
    status: 'upcoming', priority: 'medium', owner: '',
  };
}

/**
 * Phase 1: Lấy events của 1 showroom (qua showroom_code) cho tất cả tháng trong năm.
 */
export async function fetchEventsByShowroom(showroom_code: string, unit_id?: string): Promise<EventsByMonth> {
  const emptyMonths = (): EventsByMonth => {
    const e: EventsByMonth = {};
    for (let i = 1; i <= 12; i++) e[i] = [];
    return e;
  };
  if (typeof window === 'undefined') return emptyMonths();

  const supabase = createClient();
  let query = supabase.from('thaco_events').select('*').eq('showroom_code', showroom_code);
  // Include events belonging to the unit OR events with no unit set (legacy/global)
  if (unit_id && unit_id !== 'all') query = query.or(`unit_id.eq.${unit_id},unit_id.is.null`);

  const { data, error } = await query;
  if (error || !data) return emptyMonths();

  const merged = emptyMonths();
  data.forEach((row) => {
    let month = 1;
    if (row.date) {
      if (row.date.includes('/')) month = parseInt(row.date.split('/')[1]);
      else month = parseInt(row.date.split('-')[1]);
    }
    const ev: EventItem = {
      id: Number(row.id),
      unit_id: row.unit_id,
      showroom_code: row.showroom_code || row.showroom || '',
      showroom: row.showroom || '',
      name: row.name || '',
      type: row.type || '',
      date: row.date || '',
      location: row.location || '',
      brands: row.brands || [],
      budget: Number(row.budget) || 0,
      leads: row.leads, gdtd: row.gdtd, deals: row.deals,
      testDrives: row.test_drives,
      endDate: row.end_date,
      budgetSpent: row.budget_spent,
      leadsActual: row.leads_actual,
      gdtdActual: row.gdtd_actual,
      dealsActual: row.deals_actual,
      testDrivesActual: row.test_drives_actual,
      status: row.status, priority: row.priority, owner: row.owner,
      notes: row.notes, reportLink: row.report_link,
    };
    if (merged[month]) merged[month].push(ev);
  });
  return merged;
}

