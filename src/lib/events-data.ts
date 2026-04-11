/**
 * events-data.ts — Single source of truth cho dữ liệu sự kiện marketing
 *
 * Planning page (planning/page.tsx) ghi sự kiện vào:
 *   localStorage key: 'thaco-mkt-events'
 *   format: Record<number, EventItem[]>  (key = month number)
 *
 * Events dashboard (events/page.tsx) đọc từ cùng key đó.
 * Sau này khi có Supabase, chỉ cần thay hàm loadEvents/saveEvents bên dưới.
 */

// ─── Shared Types ──────────────────────────────────────────────────────────────

/** EventItem: dùng đúng cấu trúc này cho cả planning và events dashboard */
export interface EventItem {
  id: number;
  unit_id?: string;
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

// ─── Seed / Mock Data ──────────────────────────────────────────────────────────
/**
 * Dữ liệu seed mặc định — dùng khi localStorage trống hoặc chưa có data.
 * PHẢI khớp với initData trong planning/page.tsx để không lệch nhau.
 * Tháng 4 có 4 sự kiện đang active, tháng khác có dữ liệu mô phỏng.
 */
export const SEED_EVENTS_BY_MONTH: EventsByMonth = {
  1: [
    { id: 101, showroom: 'Phạm Văn Đồng', name: 'Lái thử đầu xuân KIA', type: 'Lái thử', date: '12/01/2026', location: 'Sân vận động Mỹ Đình', brands: ['KIA', 'New Carnival', 'Sportage'], budget: 35, budgetSpent: 35, leads: 120, deals: 8, status: 'completed', priority: 'high', owner: 'Trần Văn A' },
    { id: 102, showroom: 'Giải Phóng', name: 'Trưng bày Mazda Tết', type: 'Trưng bày', date: '18/01/2026', endDate: '25/01/2026', location: 'Vincom Bà Triệu', brands: ['Mazda', 'Mazda CX-5', 'CX-30'], budget: 25, budgetSpent: 24, leads: 85, deals: 5, status: 'completed', priority: 'medium', owner: 'Nguyễn Thị B' },
  ],
  2: [
    { id: 201, showroom: 'Đông Trù', name: 'Roadshow SUV Châu Âu', type: 'Roadshow', date: '08/02/2026', endDate: '10/02/2026', location: 'Aeon Mall Long Biên', brands: ['Peugeot', 'Mazda', '3008', '5008', 'Mazda CX-8'], budget: 55, budgetSpent: 52, leads: 200, deals: 12, status: 'completed', priority: 'high', owner: 'Lê Văn C' },
    { id: 202, showroom: 'Long Biên (BMW)', name: 'Workshop BMW đầu năm', type: 'Workshop', date: '20/02/2026', location: 'BMW Showroom', brands: ['BMW', 'Nhóm doanh số chính'], budget: 40, budgetSpent: 38, leads: 60, deals: 4, status: 'completed', priority: 'medium', owner: 'Phạm Thị D' },
  ],
  3: [
    { id: 301, showroom: 'Nguyễn Văn Cừ', name: 'Lái thử New Seltos & Sonet', type: 'Lái thử', date: '05/03/2026', location: 'KĐT Ecopark', brands: ['KIA', 'New Seltos', 'New Sonet'], budget: 30, budgetSpent: 28, leads: 95, deals: 7, status: 'completed', priority: 'high', owner: 'Trần Văn A' },
    { id: 302, showroom: 'Bạch Đằng/TKC', name: 'Trưng bày Peugeot 3008/5008', type: 'Trưng bày', date: '15/03/2026', endDate: '22/03/2026', location: 'TTTM Vincom Mega Mall', brands: ['Peugeot', '3008', '5008'], budget: 45, budgetSpent: 44, leads: 150, deals: 9, status: 'completed', priority: 'high', owner: 'Nguyễn Thị B' },
    { id: 303, showroom: 'Đài Tư', name: 'Ngày hội xe tải Q1', type: 'Sự kiện KH', date: '28/03/2026', location: 'KCN Đài Tư', brands: ['TẢI BUS', 'Tải trung', 'TN ĐK BN'], budget: 20, budgetSpent: 18, leads: 40, deals: 3, status: 'completed', priority: 'low', owner: 'Hoàng Văn E' },
  ],
  4: [
    // ── Khớp 100% với planning/page.tsx initData month=4 ──
    { id: 1, showroom: 'Phạm Văn Đồng', name: 'Lái thử xe cuối tuần', type: 'Lái thử', date: '10/04/2026', location: 'Highlands Hồ Tây', brands: ['KIA', 'New Carnival', 'Sportage'], budget: 30, leads: 100, gdtd: 30, deals: 8, testDrives: 50, budgetSpent: 12, leadsActual: 45, gdtdActual: 14, dealsActual: 2, testDrivesActual: 28, status: 'in_progress', priority: 'high', owner: 'Trần Văn A' },
    { id: 2, showroom: 'Giải Phóng', name: 'Trưng bày bộ đôi SUV Châu Âu', type: 'Trưng bày', date: '15/04/2026', endDate: '20/04/2026', location: 'Vincom Minh Khai', brands: ['Peugeot', 'Mazda'], budget: 45, leads: 150, gdtd: 45, deals: 11, testDrives: 0, status: 'upcoming', priority: 'high', owner: 'Nguyễn Thị B' },
    { id: 3, showroom: 'Long Biên (BMW)', name: 'Ra mắt New 5-Series 2025', type: 'Ra mắt sản phẩm', date: '20/04/2026', location: 'HN Lotte Hotel', brands: ['BMW', 'Nhóm doanh số chính', 'Nhóm cao cấp'], budget: 80, leads: 60, gdtd: 18, deals: 5, testDrives: 20, status: 'upcoming', priority: 'high', owner: 'Phạm Thị D' },
    { id: 4, showroom: 'Đài Tư', name: 'Ngày hội Xe Tải Thương mại', type: 'Sự kiện KH', date: '25/04/2026', location: 'KCN Đài Tư, Long Biên', brands: ['TẢI BUS', 'TN ĐK BN', 'Tải trung'], budget: 25, leads: 80, gdtd: 24, deals: 6, testDrives: 0, status: 'upcoming', priority: 'medium', owner: 'Hoàng Văn E' },
    { id: 405, showroom: 'Lê Văn Lương (BMW)', name: 'Workshop MINI lifestyle', type: 'Workshop', date: '08/04/2026', location: 'MINI Showroom', brands: ['MINI', '3-Cửa', '5-Cửa'], budget: 20, leads: 67, gdtd: 20, deals: 5, testDrives: 15, budgetSpent: 18, leadsActual: 30, dealsActual: 1, testDrivesActual: 12, status: 'in_progress', priority: 'low', owner: 'Trần Thị F' },
  ],
  5: [
    { id: 501, showroom: 'Phạm Văn Đồng', name: 'Roadshow Mazda CX-5 mới', type: 'Roadshow', date: '05/05/2026', endDate: '07/05/2026', location: 'Royal City', brands: ['Mazda', 'Mazda CX-5', 'CX-30'], budget: 60, budgetSpent: 0, leads: 0, deals: 0, status: 'upcoming', priority: 'high', owner: 'Lê Văn C' },
    { id: 502, showroom: 'Hà Nam', name: 'Lái thử Peugeot 408', type: 'Lái thử', date: '18/05/2026', location: 'TP Phủ Lý', brands: ['Peugeot', '408', '2008'], budget: 25, budgetSpent: 0, leads: 0, deals: 0, status: 'upcoming', priority: 'medium', owner: 'Nguyễn Thị B' },
  ],
  6: [
    { id: 601, showroom: 'Long Biên (BMW)', name: 'BMW Joy Fest Summer', type: 'Ra mắt sản phẩm', date: '12/06/2026', location: 'JW Marriott', brands: ['BMW', 'Nhóm cao cấp'], budget: 100, budgetSpent: 0, leads: 0, deals: 0, status: 'upcoming', priority: 'high', owner: 'Phạm Thị D' },
  ],
  7: [], 8: [], 9: [], 10: [], 11: [], 12: [],
};

import { createClient } from '@/lib/supabase/client';

// ─── Supabase I/O ──────────────────────────────────────────────────────────────

/**
 * Đọc events từ Supabase. Nếu trống → trả về SEED_EVENTS_BY_MONTH.
 */
export async function fetchEventsFromDB(): Promise<EventsByMonth> {
  if (typeof window === 'undefined') return SEED_EVENTS_BY_MONTH;
  const supabase = createClient();
  const { data, error } = await supabase.from('thaco_events').select('*');
  
  if (error || !data) return SEED_EVENTS_BY_MONTH;

  // Merge seed để đảm bảo không thiếu tháng, nhưng reset array để dùng data từ DB
  const merged: EventsByMonth = { ...SEED_EVENTS_BY_MONTH };
  for (let i = 1; i <= 12; i++) merged[i] = [];

  data.forEach((row) => {
    let month = 1;
    if (row.date) {
      if (row.date.includes('/')) month = parseInt(row.date.split('/')[1]);
      else month = parseInt(row.date.split('-')[1]);
    }

    const ev: EventItem = {
      id: Number(row.id),
      unit_id: row.unit_id,
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
      notes: row.notes
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
export async function upsertEventToDB(ev: EventItem): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const supabase = createClient();
  
  const payload = {
    id: ev.id,
    ...(ev.unit_id && { unit_id: ev.unit_id }),
    showroom: ev.showroom,
    name: ev.name,
    type: ev.type,
    date: ev.date,
    location: ev.location,
    brands: ev.brands,
    budget: ev.budget,
    leads: ev.leads,
    gdtd: ev.gdtd,
    deals: ev.deals,
    test_drives: ev.testDrives,
    end_date: ev.endDate,
    budget_spent: ev.budgetSpent,
    leads_actual: ev.leadsActual,
    gdtd_actual: ev.gdtdActual,
    deals_actual: ev.dealsActual,
    test_drives_actual: ev.testDrivesActual,
    status: ev.status,
    priority: ev.priority,
    owner: ev.owner,
    notes: ev.notes
  };

  const { error } = await supabase.from('thaco_events').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error("Error upserting event:", error);
    return false;
  }
  return true;
}

export async function deleteEventFromDB(id: number): Promise<boolean> {
  const supabase = createClient();
  const { error, count } = await supabase.from('thaco_events').delete({ count: 'exact' }).eq('id', id);
  if (error || count === 0) {
    console.error("Error deleting event or not found:", error || "No rows matched");
    return false;
  }
  return true;
}

/**
 * Tính status tự động dựa trên ngày hiện tại nếu event chưa có status.
 * "today" mặc định là ngày thực hoặc truyền vào để test.
 */
export function inferEventStatus(event: EventItem, today?: Date): EventStatus {
  if (event.status) return event.status;
  const t = today || new Date();
  // Normalize về 00:00:00 để tránh lệch timezone khi so sánh ngày
  t.setHours(0, 0, 0, 0);
  const parts = event.date.split('/');
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  d.setHours(0, 0, 0, 0);
  // Dùng Math.round nhất quán với daysDiff() trong tasks/notifications
  const diffDays = Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'completed';
  if (diffDays === 0) return 'in_progress';
  return 'upcoming';
}

// ─── Shared Constants & Helpers ───────────────────────────────

export const EVENT_TYPES = ['Lái thử', 'Trưng bày', 'Sự kiện KH', 'Ra mắt sản phẩm', 'Workshop', 'Roadshow'];
export const PRIORITIES: EventPriority[] = ['high', 'medium', 'low'];

import { DEMO_KPI_RATES } from './master-data';

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

export function emptyEvent(month: number, defaultShowroom: string): EventItem {
  const mm = String(month).padStart(2, '0');
  return {
    id: Date.now(),
    name: '', type: 'Lái thử', showroom: defaultShowroom,
    date: `01/${mm}/2026`, location: '',
    brands: [], budget: 0,
    leads: 0, gdtd: 0, deals: 0, testDrives: 0,
    status: 'upcoming', priority: 'medium', owner: '',
  };
}

