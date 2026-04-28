import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { showroom_id, unit_id, year, month, showroom_name, viewer_name } = await request.json();

    if (!showroom_id || !year || !month) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Tránh spam: kiểm tra xem đã có notification "viewed" trong 1 giờ gần nhất chưa
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('thaco_notifications')
      .select('id')
      .eq('type', 'plan_viewed_by_gd')
      .eq('showroom_id', showroom_id)
      .eq('year', year)
      .eq('month', month)
      .eq('created_by_name', viewer_name || '')
      .gte('created_at', oneHourAgo)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, skipped: true });
    }

    await supabase.from('thaco_notifications').insert({
      unit_id: unit_id || null,
      recipient_roles: ['mkt_brand', 'pt_mkt_cty', 'super_admin'],
      type: 'plan_viewed_by_gd',
      showroom_id,
      showroom_name: showroom_name || '',
      year,
      month,
      message: `GĐ SR ${showroom_name} (${viewer_name}) đã xem kế hoạch tháng ${month}/${year}`,
      created_by_name: viewer_name || '',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/planning/viewed]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
