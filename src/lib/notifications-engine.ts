/**
 * notifications-engine.ts — Tự động sinh thông báo từ dữ liệu thật
 *
 * Engine này quét events, budget plans, actual entries để tạo notification items.
 * Quy tắc nghiệp vụ:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOẠI            │ NGUỒN         │ THỜI ĐIỂM                               │
 * ├─────────────────┼───────────────┼─────────────────────────────────────────────┤
 * │ task            │ Budget Plans  │ Ngày 15-25: nhắc lập KH tháng tới        │
 * │ task            │ Actual Entries│ Ngày 1-10: nhắc nộp BC thực hiện          │
 * │ warning         │ Events        │ SK quá hạn chưa quyết toán               │
 * │ warning         │ Budget/Actual │ Quá hạn chưa hoàn thành                  │
 * │ info            │ Events        │ SK sắp diễn ra 2-14 ngày                 │
 * │ info            │ Events        │ SK diễn ra ngày mai / hôm nay            │
 * │ approval        │ Budget Plans  │ Đang chờ duyệt / đã duyệt               │
 * │ success         │ Events        │ SK hoàn thành, đã quyết toán             │
 * └─────────────────┴───────────────┴─────────────────────────────────────────────┘
 */

import { fetchEventsFromDB, type EventItem } from './events-data';
import { type ThacUser, roleIsAdmin } from '@/types/database';

interface PlanSubmissionRow {
  showroom_id: string;
  showroom_code: string;  // joined from thaco_showrooms
  year: number;
  month: number;
  entry_type: 'plan' | 'actual';
  status: 'draft' | 'sent';
  updated_at: string | null;
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'approval' | 'task';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  time: string;        // relative time display
  timestamp: number;   // for sorting (lower = more recent/urgent)
  read: boolean;
  important: boolean;
  deepLink?: string;   // link to relevant page
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseDate(dStr: string): Date | null {
  if (!dStr) return null;
  const parts = dStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

function daysDiff(date: Date, today?: Date): number {
  const t = today ?? new Date();
  t.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function monthName(month: number): string {
  return `Tháng ${month}`;
}

// ─── Budget Plan Notifications ──────────────────────────────────────────────────

function generateBudgetPlanNotifications(
  budgetPlans: PlanSubmissionRow[],
  today: Date,
  profile: ThacUser | null
): NotificationItem[] {
  const notifs: NotificationItem[] = [];
  const dayOfMonth = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const hasNextMonthPlan = budgetPlans.some(p => p.month === nextMonth);
  const nextMonthPlan = budgetPlans.find(p => p.month === nextMonth);

  const isAdmin = profile ? roleIsAdmin(profile.role) : false;

  // ── Nhắc lập kế hoạch ngân sách tháng tới ──
  // CHỈ hiển thị cho user MKT/GĐ Showroom (không phải admin) NẾU họ CHƯA nộp (draft hoặc chưa tạo)
  const needsToSubmit = !hasNextMonthPlan;
  if (!isAdmin && needsToSubmit) {
    if (dayOfMonth >= 26) {
      // QUÁ HẠN — chưa lập kế hoạch
      notifs.push({
        id: `budget_plan_overdue_${nextMonth}`,
        type: 'warning',
        priority: 'urgent',
        title: `Quá hạn lập kế hoạch ${monthName(nextMonth)}`,
        message: `Hạn chót ngày 25 đã qua. Cần lập kế hoạch ngân sách ${monthName(nextMonth)} NGAY để không ảnh hưởng tiến độ.`,
        time: `Quá hạn ${dayOfMonth - 25} ngày`,
        timestamp: 0, // highest priority
        read: false,
        important: true,
        deepLink: `/planning?month=${nextMonth}`,
      });
    } else if (dayOfMonth >= 20) {
      // SẮP ĐẾN HẠN
      const daysLeft = 25 - dayOfMonth;
      notifs.push({
        id: `budget_plan_due_${nextMonth}`,
        type: 'task',
        priority: daysLeft <= 2 ? 'high' : 'normal',
        title: `Lập kế hoạch ngân sách ${monthName(nextMonth)}`,
        message: `Còn ${daysLeft} ngày (hạn chót: ngày 25). Cần hoàn thành kế hoạch ngân sách & KPI cho ${monthName(nextMonth)}.`,
        time: `Còn ${daysLeft} ngày`,
        timestamp: daysLeft,
        read: false,
        important: daysLeft <= 2,
        deepLink: `/planning?month=${nextMonth}`,
      });
    } else if (dayOfMonth >= 15) {
      // NHẮC TRƯỚC
      notifs.push({
        id: `budget_plan_reminder_${nextMonth}`,
        type: 'info',
        priority: 'low',
        title: `Sắp đến kỳ lập kế hoạch ${monthName(nextMonth)}`,
        message: `Kế hoạch ngân sách ${monthName(nextMonth)} cần hoàn thành trước ngày 25. Bắt đầu chuẩn bị từ bây giờ.`,
        time: `Còn ${25 - dayOfMonth} ngày`,
        timestamp: 25 - dayOfMonth,
        read: false,
        important: false,
        deepLink: `/planning?month=${nextMonth}`,
      });
    }
  }

    // ── Kế hoạch vừa cập nhật (thay cho duyệt) ──
  // Tìm các kế hoạch mới được cập nhật trong vòng 2 ngày
  const recentPlans = budgetPlans.filter(p => {
    if (!p.updated_at) return false;
    const updatedAt = new Date(p.updated_at);
    return (today.getTime() - updatedAt.getTime()) < 2 * 24 * 60 * 60 * 1000;
  });

  recentPlans.forEach(p => {
    notifs.push({
      id: `budget_plan_updated_${p.month}_${p.showroom_code}_${p.updated_at}`,
      type: 'info',
      priority: 'low',
      title: `Cập nhật kế hoạch ${monthName(p.month)}`,
      message: isAdmin 
        ? `Đơn vị ${p.showroom_code} vừa cập nhật kế hoạch ngân sách ${monthName(p.month)}.`
        : `Kế hoạch ${monthName(p.month)} đã được đồng bộ hệ thống.`,
      time: 'Vừa cập nhật',
      timestamp: 5,
      read: !isAdmin,
      important: false,
      deepLink: `/planning?month=${p.month}`,
    });
  });

  // ── Kế hoạch tháng hiện tại nếu chưa có ──
  const hasCurrentPlan = budgetPlans.some(p => p.month === currentMonth);
  if (!isAdmin && !hasCurrentPlan && dayOfMonth <= 5) {
    notifs.push({
      id: `budget_plan_current_${currentMonth}`,
      type: 'warning',
      priority: 'urgent',
      title: `Chưa nộp kế hoạch ${monthName(currentMonth)}`,
      message: `Đã sang tháng mới nhưng chưa gửi kế hoạch ngân sách ${monthName(currentMonth)}. Cần hoàn thiện và gửi gấp!`,
      time: 'Cần xử lý ngay',
      timestamp: 0,
      read: false,
      important: true,
      deepLink: `/planning?month=${currentMonth}`,
    });
  }

  return notifs;
}

// ─── Actual Entry (Báo cáo thực hiện) Notifications ─────────────────────────────

function generateActualEntryNotifications(
  actualEntries: PlanSubmissionRow[],
  today: Date,
  profile: ThacUser | null
): NotificationItem[] {
  const notifs: NotificationItem[] = [];
  const dayOfMonth = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const isAdmin = profile ? roleIsAdmin(profile.role) : false;

  // Kiểm tra BC thực hiện tháng trước
  const prevMonthEntry = actualEntries.find(e => e.month === prevMonth);
  const hasPrevMonthActual = !!prevMonthEntry;
    // ── Nhắc nộp báo cáo thực hiện tháng trước ──
  if (!isAdmin && !hasPrevMonthActual) {
    const deadline = 10; // hạn chót ngày 10

    if (dayOfMonth > deadline) {
      // QUÁ HẠN
      notifs.push({
        id: `actual_overdue_${prevMonth}`,
        type: 'warning',
        priority: 'urgent',
        title: `Quá hạn báo cáo thực hiện ${monthName(prevMonth)}`,
        message: `Hạn chót ngày ${deadline} đã qua ${dayOfMonth - deadline} ngày. ${!hasPrevMonthActual ? 'Chưa có dữ liệu' : 'Dữ liệu đang ở trạng thái Nháp'}. Cần hoàn thành NGAY!`,
        time: `Quá hạn ${dayOfMonth - deadline} ngày`,
        timestamp: 0,
        read: false,
        important: true,
        deepLink: `/budget?month=${prevMonth}`,
      });
    } else if (dayOfMonth >= 7) {
      // SẮP HẾT HẠN
      const daysLeft = deadline - dayOfMonth;
      notifs.push({
        id: `actual_due_soon_${prevMonth}`,
        type: 'task',
        priority: 'high',
        title: `Sắp hết hạn BC thực hiện ${monthName(prevMonth)}`,
        message: `Còn ${daysLeft} ngày (hạn chót: ngày ${deadline}). ${!hasPrevMonthActual ? 'Chưa bắt đầu nhập liệu' : 'Đang ở trạng thái Nháp, cần nộp chính thức'}.`,
        time: `Còn ${daysLeft} ngày`,
        timestamp: daysLeft,
        read: false,
        important: true,
        deepLink: `/budget?month=${prevMonth}`,
      });
    } else if (dayOfMonth >= 1) {
      // NHẮC THƯỜNG
      const daysLeft = deadline - dayOfMonth;
      notifs.push({
        id: `actual_reminder_${prevMonth}`,
        type: 'task',
        priority: 'normal',
        title: `Nhập báo cáo thực hiện ${monthName(prevMonth)}`,
        message: `Đã sang tháng mới. Cần nhập dữ liệu thực hiện ${monthName(prevMonth)} trước ngày ${deadline} (còn ${daysLeft} ngày).`,
        time: `Còn ${daysLeft} ngày`,
        timestamp: daysLeft + 10,
        read: false,
        important: false,
        deepLink: `/budget?month=${prevMonth}`,
      });
    }
  }

  // ── BC Thực hiện vừa cập nhật ──
  const recentEntries = actualEntries.filter(e => {
    if (!e.updated_at) return false;
    const updatedAt = new Date(e.updated_at);
    // Nếu cập nhật trong vòng 2 ngày qua
    return (today.getTime() - updatedAt.getTime()) < 2 * 24 * 60 * 60 * 1000;
  });

  recentEntries.forEach(e => {
    notifs.push({
      id: `actual_entry_updated_${e.month}_${e.showroom_code}_${e.updated_at}`,
      type: 'info',
      priority: 'low',
      title: `Cập nhật báo cáo TH ${monthName(e.month)}`,
      message: isAdmin 
        ? `Đơn vị ${e.showroom_code} vừa lưu báo cáo thực hiện ${monthName(e.month)}.`
        : `Báo cáo thực hiện ${monthName(e.month)} đã được đồng bộ.`,
      time: 'Vừa cập nhật',
      timestamp: 5,
      read: !isAdmin,
      important: false,
      deepLink: `/budget?month=${e.month}`,
    });
  });

  return notifs;
}

// ─── Event Notifications ────────────────────────────────────────────────────────

function generateEventNotifications(
  events: EventItem[],
  today: Date,
  profile: ThacUser | null
): NotificationItem[] {
  const notifs: NotificationItem[] = [];

  for (const ev of events) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate, new Date(today));

    // ── SK quá hạn, chưa quyết toán ──
    if (diff < 0 && diff >= -7 && !ev.budgetSpent) {
      const daysAgo = Math.abs(diff);
      notifs.push({
        id: `event_settle_${ev.id}`,
        type: 'warning',
        priority: daysAgo >= 4 ? 'urgent' : 'high',
        title: `Quyết toán: ${ev.name}`,
        message: `Sự kiện tại ${ev.showroom} đã qua ${daysAgo} ngày. Cần nhập kết quả thực hiện và quyết toán ngân sách.`,
        time: `${daysAgo} ngày trước`,
        timestamp: -daysAgo,
        read: false,
        important: daysAgo >= 3,
        deepLink: `/events?id=${ev.id}`,
      });
    }

    // ── SK ngày mai ──
    if (diff === 1) {
      notifs.push({
        id: `event_tomorrow_${ev.id}`,
        type: 'task',
        priority: 'urgent',
        title: `NGÀY MAI: ${ev.name}`,
        message: `Sự kiện tại ${ev.showroom} diễn ra NGÀY MAI (${ev.date}). Kiểm tra nhân sự, vật tư, ngân sách lần cuối.`,
        time: 'Ngày mai',
        timestamp: 1,
        read: false,
        important: true,
        deepLink: `/events?id=${ev.id}`,
      });
    }

    // ── SK hôm nay ──
    if (diff === 0) {
      notifs.push({
        id: `event_today_${ev.id}`,
        type: 'info',
        priority: 'high',
        title: `HÔM NAY: ${ev.name}`,
        message: `Sự kiện tại ${ev.showroom} đang diễn ra hôm nay. Theo dõi tiến độ và hỗ trợ kịp thời.`,
        time: 'Hôm nay',
        timestamp: 0,
        read: false,
        important: true,
        deepLink: `/events?id=${ev.id}`,
      });
    }

    // ── SK 2-3 ngày nữa ──
    if (diff >= 2 && diff <= 3) {
      notifs.push({
        id: `event_soon_${ev.id}`,
        type: 'task',
        priority: 'high',
        title: `Chuẩn bị cuối: ${ev.name}`,
        message: `Còn ${diff} ngày. Xác nhận lịch, nhân sự và vật tư cho sự kiện tại ${ev.showroom}.`,
        time: `Còn ${diff} ngày`,
        timestamp: diff,
        read: false,
        important: false,
        deepLink: `/events?id=${ev.id}`,
      });
    }

    // ── SK 4-7 ngày nữa ──
    if (diff >= 4 && diff <= 7) {
      notifs.push({
        id: `event_week_${ev.id}`,
        type: 'info',
        priority: 'normal',
        title: `Tuần này: ${ev.name}`,
        message: `Sự kiện tại ${ev.showroom} sau ${diff} ngày nữa (${ev.date}). Kiểm tra tiến độ chuẩn bị.`,
        time: `Còn ${diff} ngày`,
        timestamp: diff + 10,
        read: false,
        important: false,
        deepLink: `/events?id=${ev.id}`,
      });
    }

    // ── SK 8-14 ngày nữa ──
    if (diff >= 8 && diff <= 14) {
      notifs.push({
        id: `event_upcoming_${ev.id}`,
        type: 'info',
        priority: 'low',
        title: `Sắp tới: ${ev.name}`,
        message: `Sự kiện tại ${ev.showroom} sau ${diff} ngày (${ev.date}). Lên kế hoạch nhân sự và ngân sách.`,
        time: `Còn ${diff} ngày`,
        timestamp: diff + 20,
        read: true,
        important: false,
        deepLink: `/events?id=${ev.id}`,
      });
    }
  }

  return notifs;
}

// ─── Deadline Notifications (per-SR) ────────────────────────────────────────────

/**
 * Sinh thông báo deadline cho PT MKT (pt_mkt_cty / super_admin):
 * quét toàn bộ SR trong unit, tìm SR nào chưa submit trước deadline.
 */
function generateDeadlineNotifications(
  budgetPlans: PlanSubmissionRow[],
  showroomNames: Record<string, string>, // code -> name mapping
  today: Date,
  profile: ThacUser | null,
  deadlineDay: number = 25
): NotificationItem[] {
  const notifs: NotificationItem[] = [];
  if (!profile) return notifs;

  const isManager = profile.role === 'pt_mkt_cty' || profile.role === 'super_admin';
  if (!isManager) return notifs;

  const dayOfMonth = today.getDate();
  if (dayOfMonth < deadlineDay - 5) return notifs; // Chỉ nhắc trong 5 ngày trước deadline

  const nextMonth = today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2;

  // Tìm SR chưa submit cho tháng tới
  const submittedCodes = new Set(
    budgetPlans
      .filter(p => p.month === nextMonth)
      .map(p => p.showroom_code)
  );

  const allCodes = Object.keys(showroomNames);
  const pendingCodes = allCodes.filter(c => !submittedCodes.has(c));

  if (pendingCodes.length === 0) return notifs;

  const daysLeft = deadlineDay - dayOfMonth;
  const pendingNames = pendingCodes
    .map(c => showroomNames[c] || c)
    .join(', ');

  const isOverdue = daysLeft < 0;

  notifs.push({
    id: `deadline_sr_pending_${nextMonth}`,
    type: isOverdue ? 'warning' : 'task',
    priority: isOverdue ? 'urgent' : daysLeft <= 2 ? 'high' : 'normal',
    title: isOverdue
      ? `Quá hạn: ${pendingCodes.length} SR chưa nộp KH T${nextMonth}`
      : `${pendingCodes.length} SR chưa nộp KH Tháng ${nextMonth}`,
    message: isOverdue
      ? `Đã quá hạn ${Math.abs(daysLeft)} ngày. SR chưa nộp: ${pendingNames}. Có thể dùng chức năng "Cưỡng chế duyệt".`
      : `Còn ${daysLeft} ngày (hạn ngày ${deadlineDay}). SR chưa nộp: ${pendingNames}.`,
    time: isOverdue ? `Quá hạn ${Math.abs(daysLeft)} ngày` : `Còn ${daysLeft} ngày`,
    timestamp: isOverdue ? -1 : daysLeft,
    read: false,
    important: isOverdue || daysLeft <= 2,
    deepLink: `/planning?month=${nextMonth}&view=all`,
  });

  return notifs;
}

// ─── Main Engine ────────────────────────────────────────────────────────────────

export interface NotificationResult {
  notifications: NotificationItem[];
  counts: {
    total: number;
    unread: number;
    urgent: number;
  };
}

// ─── In-memory cache (30s TTL) ───────────────────────────────────────────────
// Ngăn chặn nhiều component gọi generateNotifications() cùng lúc.
// StatusBar + NotificationPanel đều dùng chung cache này.

interface NotifCache {
  result: NotificationResult;
  expireAt: number;  // Date.now() + TTL
  unit_id: string;
}

let _notifCache: NotifCache | null = null;

/** Xóa cache thủ công khi user muốn refresh cứng */
export function invalidateNotifCache(): void {
  _notifCache = null;
}

/**
 * Fetch tất cả dữ liệu và sinh danh sách thông báo.
 * Có in-memory cache 30s TTL để tránh duplicate fetch từ
 * StatusBar và NotificationPanel.
 *
 * @param unit_id - Unit ID để lọc (undefined = toàn hệ thống)
 * @param forceRefresh - true để bỏ qua cache (khi user click Refresh)
 */
export async function generateNotifications(
  unit_id?: string,
  forceRefresh = false,
): Promise<NotificationResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cacheKey = unit_id ?? '__all__';

  // Cache hit — trả về ngay, không fetch
  if (
    !forceRefresh &&
    _notifCache &&
    _notifCache.unit_id === cacheKey &&
    Date.now() < _notifCache.expireAt
  ) {
    return _notifCache.result;
  }

  try {
    const { createClient } = await import('./supabase/client');
    const supabase = createClient();

    // Step A: fetch showrooms (for unit filter + code lookup)
    const showroomsRaw = await supabase
      .from('thaco_showrooms')
      .select('id, code, name, unit_id')
      .eq('is_active', true)
      .then(r => { if (r.error) throw r.error; return r.data ?? []; });

    // Build maps
    const codeByShowroomId: Record<string, string> = {};
    const showroomNames: Record<string, string> = {};
    (showroomsRaw as any[]).forEach((s: any) => {
      codeByShowroomId[s.id] = s.code;
      showroomNames[s.code] = s.name;
    });

    // Get showroom IDs for this unit (if unit_id provided)
    const unitShowroomIds = unit_id
      ? showroomsRaw.filter((s: any) => s.unit_id === unit_id).map((s: any) => s.id)
      : null;

    // Step B: fetch plan_submissions
    let submissionsQuery = supabase
      .from('thaco_plan_submissions')
      .select('showroom_id, year, month, entry_type, status, updated_at')
      .eq('year', new Date().getFullYear());

    if (unitShowroomIds) {
      submissionsQuery = submissionsQuery.in('showroom_id', unitShowroomIds);
    }

    const submissionsRaw = await submissionsQuery.then(r => { if (r.error) throw r.error; return r.data ?? []; });

    // Map to PlanSubmissionRow
    const allSubmissions: PlanSubmissionRow[] = (submissionsRaw as any[]).map((s) => ({
      showroom_id: s.showroom_id,
      showroom_code: codeByShowroomId[s.showroom_id] ?? '',
      year: s.year,
      month: s.month,
      entry_type: s.entry_type,
      status: s.status,
      updated_at: s.updated_at,
    }));

    const budgetPlans = allSubmissions.filter(s => s.entry_type === 'plan');
    const actualEntries = allSubmissions.filter(s => s.entry_type === 'actual');

    const eventsData = await fetchEventsFromDB(unit_id).catch(() => ({}) as any);
    const allEvents = Object.values(eventsData || {}).flat();

    const notifications: NotificationItem[] = [
      ...generateBudgetPlanNotifications(budgetPlans, today, null),
      ...generateActualEntryNotifications(actualEntries, today, null),
      ...generateEventNotifications(allEvents as any[], today, null),
      ...generateDeadlineNotifications(budgetPlans, showroomNames, today, null),
    ];

    const PRIORITY_ORDER: Record<NotificationPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    notifications.sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.timestamp - b.timestamp;
    });

    const result: NotificationResult = {
      notifications,
      counts: {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        urgent: notifications.filter(n => n.priority === 'urgent').length,
      },
    };

    // Lưu cache — TTL 30 giây
    _notifCache = { result, expireAt: Date.now() + 30_000, unit_id: cacheKey };

    return result;
  } catch (err) {
    console.error('NotificationsEngine: error', err);
    return { notifications: [], counts: { total: 0, unread: 0, urgent: 0 } };
  }
}
