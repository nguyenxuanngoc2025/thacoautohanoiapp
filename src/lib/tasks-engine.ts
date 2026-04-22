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
  | 'manual'; // Đối với manual task do user tạo

export interface Task {
  id: string;
  type: SystemTaskType;
  priority: TaskPriority;
  title: string;
  description: string;
  deepLink: string;
  meta?: string;
  creator?: string; 
  dueDate?: Date;
}

function parseDate(dStr: string): Date | null {
  if (!dStr) return null;
  // Handle DD/MM/YYYY
  if (dStr.includes('/')) {
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
    }
  }
  // Handle YYYY-MM-DD
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

export function generateIntelligentTasks(
  events: EventItem[],
  budgetPlans: BudgetPlanSummary[],
  userContext?: { role: string; showroom: string }
): Task[] {
  const tasks: Task[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter based on userContext if needed
  const activeEvents = userContext?.showroom && userContext.role !== 'Phó Tổng Giám Đốc' 
    ? events.filter(e => e.showroom === userContext.showroom) 
    : events;

  // 1. Cảnh báo Sự kiện
  for (const ev of activeEvents) {
    const eventDate = parseDate(ev.date);
    if (!eventDate) continue;
    const diff = daysDiff(eventDate);

    // Rule: Trễ báo cáo (Qúa hạn 1 ngày mà chưa nhập tiền thực chi)
    if (diff >= -14 && diff < 0 && !ev.budgetSpent) {
      tasks.push({
        id: `sys_report_event_${ev.id}`, 
        type: 'report_event', 
        priority: 'urgent',
        title: `Nhập kết quả: ${ev.name}`,
        description: `Sự kiện tại ${ev.showroom} đã qua ${Math.abs(diff)} ngày, NHƯNG chưa chốt ngân sách thực chi (báo cáo).`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // Rule: Chuẩn bị cận kề (Ngày mai)
    if (diff === 1) {
      tasks.push({
        id: `sys_pre_event_${ev.id}`, 
        type: 'pre_event_check', 
        priority: 'urgent',
        title: `Ngày mai: ${ev.name}`,
        description: `Sự kiện sẽ diễn ra ngày mai. Đảm bảo mọi vật tư, nhân sự và POSM tại ${ev.showroom} đã sẵn sàng.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // Rule: Xác nhận lịch (Còn 2 - 3 ngày)
    if (diff >= 2 && diff <= 3) {
      tasks.push({
        id: `sys_confirm_event_${ev.id}`, 
        type: 'confirm_event', 
        priority: 'this_week',
        title: `Xác nhận lịch: ${ev.name}`,
        description: `Sự kiện sắp diễn ra (${diff} ngày). Vui lòng xác định lịch cố định để chốt ngân sách.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }

    // Rule: Lên kế hoạch sự kiện (Còn 4 - 7 ngày)
    if (diff >= 4 && diff <= 7) {
      tasks.push({
        id: `sys_upcoming_event_${ev.id}`, 
        type: 'upcoming_event', 
        priority: 'this_month',
        title: `Chuẩn bị: ${ev.name}`,
        description: `Còn ${diff} ngày. Rà soát tiến độ khách mời và xin duyệt các hạng mục liên quan.`,
        deepLink: `/events?id=${ev.id}`,
        meta: `${ev.showroom} · ${ev.date}`,
      });
    }
  }

  // 2. Cảnh báo Ngân sách tháng (Dựa trên Sự kiện)
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
          priority: 'urgent',
          title: `Cảnh báo ngân sách: ${srName}`,
          description: `Ngân sách Sự kiện tháng ${currentMonth} đã giải ngân ${(spentRatio * 100).toFixed(0)}%. Vui lòng điều phối tránh vượt hạn mức.`,
          deepLink: `/reports`,
          meta: srName
      });
    } else if (spentRatio >= 1) {
      tasks.push({
          id: `sys_budget_over_${currentMonth}`,
          type: 'budget_overrun',
          priority: 'urgent',
          title: `VƯỢT NGÂN SÁCH Sự Kiện: ${srName}`,
          description: `Ngân sách thực chi sự kiện tháng ${currentMonth} đã VƯỢT mức kế hoạch. Tỷ lệ: ${(spentRatio * 100).toFixed(0)}%. Hãy giải trình.`,
          deepLink: `/reports`,
          meta: srName
      });
    }
  }

  // 3. Quy trình hành chính (Lập kế hoạch tháng tới)
  const dayOfMonth = today.getDate();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  if (dayOfMonth >= 25 && dayOfMonth <= 31) {
    const sr = userContext?.showroom || 'Công ty';
    // Đơn giản hóa: Trừ khi đã có ít nhất 1 khoản nào trong budgetPlans payload cho nextMonth
    const nextMonthPlan = budgetPlans.find(p => p.month === nextMonth && p.approval_status !== 'draft');
    if (!nextMonthPlan) {
      tasks.push({
        id: `sys_submit_plan_${sr}_${nextMonth}`, 
        type: 'submit_plan', 
        priority: 'urgent',
        title: `Nộp Kế hoạch Tháng ${nextMonth}`,
        description: `Đã là ngày ${dayOfMonth} cuối tháng. Chưa có bản nộp kế hoạch chính thức cho mảng Marketing tháng sau.`,
        deepLink: `/planning?month=${nextMonth}`,
        meta: `Hạn: 01/${String(nextMonth).padStart(2,'0')}`,
      });
    }
  }

  // Sắp xếp tự động
  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, this_week: 1, this_month: 2 };
  tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title, 'vi'));

  return tasks;
}
