import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/invite-user
 * Tạo user mới qua Supabase Auth Admin API, sau đó update profile.
 * Chỉ super_admin mới được gọi endpoint này.
 */
export async function POST(request: NextRequest) {
  // Xác thực người gọi là super_admin
  const supabaseServer = await createClient();
  const { data: { user: caller } } = await supabaseServer.auth.getUser();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabaseServer
    .from('thaco_users')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Chỉ Super Admin mới có quyền tạo tài khoản' }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name, role, unit_id, showroom_id, brands, is_active } = body;

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc: email, full_name, role' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Invite user (gửi email mời đặt mật khẩu)
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const userId = inviteData.user.id;

  // Upsert profile vào thaco_users
  const { error: profileError } = await adminClient.from('thaco_users').upsert({
    id: userId,
    email,
    full_name,
    role,
    unit_id: unit_id || null,
    showroom_id: showroom_id || null,
    brands: brands ?? [],
    is_active: is_active ?? true,
  });

  if (profileError) {
    return NextResponse.json({ error: `User đã tạo nhưng lỗi profile: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId });
}
