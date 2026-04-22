// app/src/app/api/cron/deadline-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Vercel sẽ gọi route này theo schedule trong vercel.json
// Cần CRON_SECRET để xác thực (set trong Vercel env vars)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const dayOfMonth = today.getDate();
  const month = today.getMonth() + 1;
  const year  = today.getFullYear();

  // Chỉ chạy khi gần deadline (ngày 20-26)
  if (dayOfMonth < 20 || dayOfMonth > 26) {
    return NextResponse.json({ skipped: true, reason: 'Not in deadline window' });
  }

  const supabase = createAdminClient();

  // Lấy tất cả showrooms đang active
  const { data: showrooms } = await supabase
    .from('thaco_showrooms')
    .select('code, unit_id')
    .eq('is_active', true);

  if (!showrooms) {
    return NextResponse.json({ error: 'No showrooms found' }, { status: 500 });
  }

  // Check từng SR cho tháng tới
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  // Step A: get submitted showroom_ids
  const { data: submittedSubs } = await supabase
    .from('thaco_plan_submissions')
    .select('showroom_id')
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .eq('entry_type', 'plan')
    .eq('status', 'sent');

  const submittedShowroomIds = (submittedSubs ?? []).map((s: any) => s.showroom_id);

  // Step B: get their codes
  const { data: submittedShowrooms } = submittedShowroomIds.length > 0
    ? await supabase
        .from('thaco_showrooms')
        .select('code')
        .in('id', submittedShowroomIds)
    : { data: [] };

  const submittedPlans = (submittedShowrooms ?? []).map((s: any) => ({ showroom_code: s.code }));

  const submittedCodes = new Set((submittedPlans || []).map((p: { showroom_code: string }) => p.showroom_code));
  const pendingSRs = showrooms.filter((s: { code: string }) => !submittedCodes.has(s.code));

  // Log kết quả (có thể mở rộng: gửi email/Slack notification)
  console.log(`[CRON] Deadline check T${nextMonth}/${nextYear}: ${pendingSRs.length} SR chưa nộp`);

  return NextResponse.json({
    checked_at: today.toISOString(),
    next_month: nextMonth,
    pending_count: pendingSRs.length,
    pending_sr: pendingSRs.map((s: { code: string }) => s.code),
  });
}
