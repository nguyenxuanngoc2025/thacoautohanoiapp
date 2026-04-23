import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  super_admin:  'Super Admin',
  pt_mkt_cty:   'PT Marketing Công ty',
  bld:          'Ban Lãnh Đạo',
  gd_showroom:  'GĐ Showroom',
  mkt_brand:    'MKT Thương hiệu',
  mkt_showroom: 'MKT Showroom',
  finance:      'Tài chính',
};

export async function POST(request: Request) {
  try {
    const {
      showroom_id, unit_id, year, month,
      entry_type = 'plan',
      showroom_name, sender_name, sender_role, brands,
    } = await request.json();

    if (!showroom_id || !year || !month) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('thaco_plan_submissions').upsert({
      showroom_id,
      year,
      month,
      entry_type,
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by_name: sender_name || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'showroom_id,year,month,entry_type' });

    const typeLabel = entry_type === 'plan' ? 'Kế hoạch' : 'Thực hiện';
    const roleLabel = ROLE_LABELS[sender_role] || sender_role || 'Nhân viên';
    const brandsInfo = brands ? ` · ${brands}` : '';

    // Message chi tiết: tên + chức vụ + showroom + thương hiệu + kỳ
    const message = `${sender_name || 'Không rõ'} (${roleLabel}) vừa gửi ${typeLabel} tháng ${month}/${year} — Showroom ${showroom_name}${brandsInfo}`;

    await supabase.from('thaco_notifications').insert({
      unit_id: unit_id || null,
      recipient_roles: ['mkt_brand', 'pt_mkt_cty', 'super_admin', 'bld'],
      type: 'plan_submitted',
      showroom_id,
      showroom_name: showroom_name || '',
      year,
      month,
      entry_type,
      message,
      created_by_name: sender_name || '',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/planning/submit]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
