import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type UserRole, roleNeedsShowroom } from '@/types/database';

const VALID_ROLES: UserRole[] = [
  'super_admin',
  'pt_mkt_cty',
  'bld',
  'gd_showroom',
  'mkt_brand',
  'mkt_showroom',
  'finance',
];

const COMPANY_ADMIN_ASSIGNABLE_ROLES: UserRole[] = [
  'bld',
  'gd_showroom',
  'mkt_brand',
  'mkt_showroom',
  'finance',
];

export async function POST(request: NextRequest) {
  const supabaseServer = await createClient();
  const { data: { user: caller } } = await supabaseServer.auth.getUser();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabaseServer
    .from('thaco_users')
    .select('role, unit_id')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || !['super_admin', 'pt_mkt_cty'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Only Super Admin or PT Marketing Cty can create users' }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, full_name, role, unit_id, showroom_id, showroom_ids, brands, is_active } = body;

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields: email, full_name, role' }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const callerRole = callerProfile.role as UserRole;
  let targetUnitId = unit_id || null;
  const targetShowroomId = showroom_id || null;
  const targetShowroomIds: string[] = Array.isArray(showroom_ids) ? showroom_ids : [];

  if (callerRole === 'pt_mkt_cty') {
    if (!callerProfile.unit_id) {
      return NextResponse.json({ error: 'PT Marketing Cty account has no assigned unit' }, { status: 403 });
    }
    if (!COMPANY_ADMIN_ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'PT Marketing Cty cannot create system admin accounts' }, { status: 403 });
    }
    if (unit_id && unit_id !== callerProfile.unit_id) {
      return NextResponse.json({ error: 'Cannot create users outside your assigned unit' }, { status: 403 });
    }
    targetUnitId = callerProfile.unit_id;
  }

  if (roleNeedsShowroom(role) && !targetShowroomId && targetShowroomIds.length === 0) {
    return NextResponse.json({ error: 'This role requires at least one showroom' }, { status: 400 });
  }

  // mkt_brand, pt_mkt_cty, gd_showroom, mkt_showroom cần có unit_id
  const rolesRequiringUnit: UserRole[] = ['pt_mkt_cty', 'gd_showroom', 'mkt_brand', 'mkt_showroom'];
  if (rolesRequiringUnit.includes(role) && !targetUnitId) {
    return NextResponse.json({ error: 'Role này yêu cầu chọn đơn vị (Công ty)' }, { status: 400 });
  }

  if (targetShowroomId) {
    const { data: showroom, error: showroomError } = await adminClient
      .from('thaco_showrooms')
      .select('unit_id')
      .eq('id', targetShowroomId)
      .single();

    if (showroomError || !showroom) {
      return NextResponse.json({ error: 'Invalid showroom' }, { status: 400 });
    }
    if (callerRole === 'pt_mkt_cty' && showroom.unit_id !== targetUnitId) {
      return NextResponse.json({ error: 'Cannot assign a showroom outside your unit' }, { status: 403 });
    }
    if (!targetUnitId) targetUnitId = showroom.unit_id;
  }

  // Tạo tài khoản nội bộ — không gửi email, không cần xác minh
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  let userId: string;

  if (createError) {
    // Nếu email đã tồn tại trong auth (orphaned profile — tạo trước đó bị lỗi mid-way),
    // tìm user hiện tại và upsert profile lại.
    const isAlreadyExists = createError.message.toLowerCase().includes('already') ||
      createError.message.toLowerCase().includes('registered') ||
      createError.message.toLowerCase().includes('email_exists');

    if (!isAlreadyExists) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Tìm auth user theo email để lấy UUID
    const { data: { users } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingAuthUser = users.find(u => u.email === email);
    if (!existingAuthUser) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Cập nhật password nếu cần
    await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      user_metadata: { full_name },
    });

    userId = existingAuthUser.id;
  } else {
    userId = createData.user.id;
  }
  const { error: profileError } = await adminClient.from('thaco_users').upsert({
    id: userId,
    email,
    full_name,
    role,
    unit_id: targetUnitId,
    showroom_id: roleNeedsShowroom(role) ? targetShowroomId : null,
    showroom_ids: roleNeedsShowroom(role) ? targetShowroomIds : [],
    brands: brands ?? [],
    is_active: is_active ?? true,
  });

  if (profileError) {
    return NextResponse.json({ error: `User was created but profile update failed: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId });
}
