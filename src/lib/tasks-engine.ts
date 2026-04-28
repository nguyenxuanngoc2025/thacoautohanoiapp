import type { EventItem } from '@/lib/events-data';

interface BudgetPlanSummary {
  showroom_code: string;
  month: number;
  year: number;
  approval_status: 'draft' | 'submitted' | 'approved';
}

export type TaskPriority = 'urgent' | 'this_week' | 'this_month';

export type SystemTaskType =
  | 'report_event'
  | 'confirm_event'
  | 'upcoming_event'
  | 'pre_event_check'
  | 'submit_plan'
  | 'budget_overrun'
  | 'manual';

export type TaskCategory = 'event' | 'plan' | 'budget' | 'manual';

export interface Task {
  id: string;
  type: SystemTaskType;
  category: TaskCategory;
  priority: TaskPriority;
  title: string;
  description: string;
  deepLink: string;
  meta?: string;
  creator?: string;
  dueDate?: Date;
  isOverdue?: boolean;
  daysUntilDue?: number;
  status?: string;
}

function parseDate(dStr: string): Date | null {
  if (!dStr) return null;
  if (dStr.includes('/')) {
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
    }
  }
  if (dStr.includes('-')) {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
    }
  }
  return null;
}

function daysDiff(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineMeta(diff: number, location: string): string {
  if (diff < 0) return `${location} · quá hạn ${Math.abs(diff)} ngày`;
  if (diff === 0) return `${location} · hôm nay`;
  if (diff === 1) return `${location} · ngày mai`;
  return `${location} · còn ${diff} ngày`;
}

function priorityFromDiff(diff: number): TaskPriority {
  if (diff <= 1) return 'urgent';
  if (diff <= 3) return 'this_week';
  return 'this_month';
}

export function generateIntelligentTasks(
  events: EventItem[],
  budgetPlans: BudgetPlanSummary[],
  userContext?: { role: string; showroom: string; brands?: string[] }
): Task[] {
  const tasks: Task[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let activeEvents = events;
  if (userContext) {
    const { role, showroom, brands } = userContext;
    // mkt_brand: chỉ thấy event có brand của mình
    if (role === 'mkt_brand' && brands?.length) {
      activeEvents = events.filter(e =>
        e.brands?.some(b => brands.includes(b))
      );
    // role showroom (gd/mkt): chỉ thấy event của showroom mình
    } else if (showroom && role !== 'Phó Tổng Giám Đốc') {
      activeEvents = events.filter(e => e.showroom === showroom);
    }
  }

  // 1. Event tasks
  for (const ev of activeEvents) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    // Overdue: chưa quyết toán, trong vòng 14 ngày
    if (diff >= -14 && diff < 0 && !ev.budgetSpent) {
      tasks.push({
        id: `sys_report_event_${ev.id}`,
        type: 'report_event',
        category: 'event',
        priority: 'urgent',
        isOverdue: true,
        daysUntilDue: diff,
        title: `Nhập kết quả: ${ev.name}`,
        description: `Sự kiện tại ${ev.showroom} đã qua ${Math.abs(diff)} ngày, chưa chốt ngân sách thực chi.`,
        deepLink: `/events?id=${ev.id}`,
        meta: deadlineMeta(diff, ev.showroom),
      });
    }

    // Ngày mai
    if (diff === 1) {
      tasks.push({
        id: `sys_pre_event_${ev.id}`,
        type: 'pre_event_check',
        category: 'event',
        priority: 'urgent',
        daysUntilDue: 1,
        title: `Ngày mai: ${ev.name}`,
        description: `Sự kiện sẽ diễn ra ngày mai. Đảm bảo vật tư, nhân sự và POSM tại ${ev.showroom} đã sẵn sàng.`,
        deepLink: `/events?id=${ev.id}`,
        meta: deadlineMeta(diff, ev.showroom),
      });
    }

    // Còn 2-3 ngày
    if (diff >= 2 && diff <= 3) {
      tasks.push({
        id: `sys_confirm_event_${ev.id}`,
        type: 'confirm_event',
        category: 'event',
        priority: 'this_week',
        daysUntilDue: diff,
        title: `Xác nhận lịch: ${ev.name}`,
        description: `Sự kiện sắp diễn ra (còn ${diff} ngày). Xác nhận lịch cố định để chốt ngân sách.`,
        deepLink: `/events?id=${ev.id}`,
        meta: deadlineMeta(diff, ev.showroom),
      });
    }

    // Còn 4-7 ngày
    if (diff >= 4 && diff <= 7) {
      tasks.push({
        id: `sys_upcoming_event_${ev.id}`,
        type: 'upcoming_event',
        category: 'event',
        priority: 'this_month',
        daysUntilDue: diff,
        title: `Chuẩn bị: ${ev.name}`,
        description: `Còn ${diff} ngày. Rà soát tiến độ khách mời và xin duyệt các hạng mục liên quan.`,
        deepLink: `/events?id=${ev.id}`,
        meta: deadlineMeta(diff, ev.showroom),
      });
    }
  }

  // 2. Budget overrun
  const currentMonth = today.getMonth() + 1;
  const eventsInMonth = activeEvents.filter(ev => {
    const d = parseDate(ev.date);
    return d && d.getMonth() + 1 === currentMonth;
  });
  const totalBudget = eventsInMonth.reduce((sum, ev) => sum + (Number(ev.budget) || 0), 0);
  const totalSpent = eventsInMonth.reduce((sum, ev) => sum + (Number(ev.budgetSpent) || 0), 0);
  if (totalBudget > 0) {
    const spentRatio = totalSpent / totalBudget;
    const srName = userContext?.showroom || 'các Chi nhánh';
    if (spentRatio >= 0.85 && spentRatio < 1) {
      tasks.push({
        id: `sys_budget_warn_${currentMonth}`,
        type: 'budget_overrun',
        category: 'budget',
        priority: 'urgent',
        title: `Cảnh báo ngân sách: ${srName}`,
        description: `Ngân sách Sự kiện tháng ${currentMonth} đã giải ngân ${(spentRatio * 100).toFixed(0)}%. Vui lòng điều phối tránh vượt hạn mức.`,
        deepLink: `/reports`,
        meta: srName,
      });
    } else if (spentRatio >= 1) {
      tasks.push({
        id: `sys_budget_over_${currentMonth}`,
        type: 'budget_overrun',
        category: 'budget',
        priority: 'urgent',
        isOverdue: true,
        title: `VƯỢT NGÂN SÁCH Sự Kiện: ${srName}`,
        description: `Ngân sách thực chi sự kiện tháng ${currentMonth} đã VƯỢT mức kế hoạch. Tỷ lệ: ${(spentRatio * 100).toFixed(0)}%.`,
        deepLink: `/reports`,
        meta: srName,
      });
    }
  }

  // 3. Submit plan — nhắc từ ngày 20
  const dayOfMonth = today.getDate();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  if (dayOfMonth >= 20) {
    const sr = userContext?.showroom || 'Công ty';
    const nextMonthPlan = budgetPlans.find(p => p.month === nextMonth && p.approval_status !== 'draft');
    if (!nextMonthPlan) {
      const daysLeft = 25 - dayOfMonth;
      tasks.push({
        id: `sys_submit_plan_${sr}_${nextMonth}`,
        type: 'submit_plan',
        category: 'plan',
        priority: priorityFromDiff(daysLeft),
        daysUntilDue: daysLeft,
        isOverdue: daysLeft < 0,
        title: `Nộp Kế hoạch Tháng ${nextMonth}`,
        description: daysLeft < 0
          ? `Đã quá hạn ${Math.abs(daysLeft)} ngày. Chưa có bản nộp kế hoạch chính thức cho tháng ${nextMonth}.`
          : `Còn ${daysLeft} ngày (hạn ngày 25). Chưa có bản nộp kế hoạch chính thức cho tháng ${nextMonth}.`,
        deepLink: `/planning?month=${nextMonth}`,
        meta: daysLeft < 0 ? `quá hạn ${Math.abs(daysLeft)} ngày` : daysLeft === 0 ? 'hôm nay' : `còn ${daysLeft} ngày`,
      });
    }
  }

  // Sort: overdue trước, rồi priority, rồi daysUntilDue
  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, this_week: 1, this_month: 2 };
  tasks.sort((a, b) => {
    if (!!a.isOverdue !== !!b.isOverdue) return b.isOverdue ? 1 : -1;
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return (a.daysUntilDue ?? 99) - (b.daysUntilDue ?? 99);
  });

  return tasks;
}
