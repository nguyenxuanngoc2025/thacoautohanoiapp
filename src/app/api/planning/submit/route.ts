import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

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

// Roles bị giới hạn theo showroom_ids
const SHOWROOM_RESTRICTED_ROLES = ['mkt_showroom', 'gd_showroom'];

export async function POST(request: Request) {
  try {
    // ── Verify caller identity ───────────────────────────────────────────────
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { data: callerProfile } = await serverClient
      .from('thaco_users')
      .select('role, is_active, showroom_ids, showroom:thaco_showrooms(id, code)')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !callerProfile.is_active) {
      return NextResponse.json({ success: false, error: 'Account inactive or not found' }, { status: 403 });
    }

    const {
      showroom_id, unit_id, year, month,
      entry_type = 'plan',
      showroom_name, sender_name, sender_role, brands,
      brandList,
    } = await request.json();

    if (!showroom_id || !year || !month) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // ── Verify showroom ownership cho role bị giới hạn ──────────────────────
    if (SHOWROOM_RESTRICTED_ROLES.includes(callerProfile.role)) {
      const assignedIds: string[] = Array.isArray(callerProfile.showroom_ids) && callerProfile.showroom_ids.length > 0
        ? callerProfile.showroom_ids
        : (callerProfile.showroom as any)?.id ? [(callerProfile.showroom as any).id] : [];

      if (!assignedIds.includes(showroom_id)) {
        return NextResponse.json({ success: false, error: 'Không có quyền gửi kế hoạch cho showroom này' }, { status: 403 });
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert một record per brand. brandList=[] hoặc không truyền → [''] (cả showroom)
    const brandsToUpsert: string[] = Array.isArray(brandList) && brandList.length > 0
      ? brandList
      : [''];

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from('thaco_plan_submissions').upsert(
      brandsToUpsert.map(brand => ({
        showroom_id,
        brand,
        year,
        month,
        entry_type,
        status: 'sent',
        sent_at: now,
        sent_by_name: sender_name || '',
        updated_at: now,
      })),
      { onConflict: 'showroom_id,brand,year,month,entry_type' }
    );

    if (upsertError) {
      console.error('[API/planning/submit] upsert error:', upsertError);
      return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 });
    }

    const typeLabel = entry_type === 'plan' ? 'Kế hoạch' : 'Thực hiện';
    // mkt_brand: ghi rõ thương hiệu vào chức danh, VD: "MKT Thương hiệu · Tải Bus"
    const baseRoleLabel = ROLE_LABELS[sender_role] || sender_role || 'Nhân viên';
    const roleLabel = (sender_role === 'mkt_brand' && brands)
      ? `${baseRoleLabel} · ${brands}`
      : baseRoleLabel;

    // Message chi tiết: tên + chức vụ (+ thương hiệu nếu mkt_brand) + showroom + kỳ
    const message = `${sender_name || 'Không rõ'} (${roleLabel}) vừa gửi ${typeLabel} tháng ${month}/${year} — Showroom ${showroom_name}`;

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
