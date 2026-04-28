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
    return NextResponse.json({ error: 'Only Super Admin or PT Marketing Cty can update users' }, { status: 403 });
  }

  const { userId, full_name, role, unit_id, showroom_id, showroom_ids, brands, is_active } = await request.json();

  if (!userId || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields: userId, full_name, role' }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const callerRole = callerProfile.role as UserRole;
  let targetUnitId = unit_id || null;
  const targetShowroomId = showroom_id || null;

  if (callerRole === 'pt_mkt_cty') {
    if (!callerProfile.unit_id) {
      return NextResponse.json({ error: 'PT Marketing Cty account has no assigned unit' }, { status: 403 });
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from('thaco_users')
      .select('role, unit_id')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    if (
      targetProfile.unit_id !== callerProfile.unit_id ||
      !COMPANY_ADMIN_ASSIGNABLE_ROLES.includes(targetProfile.role as UserRole)
    ) {
      return NextResponse.json({ error: 'You cannot update this user' }, { status: 403 });
    }

    if (!COMPANY_ADMIN_ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'PT Marketing Cty cannot assign system admin roles' }, { status: 403 });
    }
    if (unit_id && unit_id !== callerProfile.unit_id) {
      return NextResponse.json({ error: 'Cannot move users outside your assigned unit' }, { status: 403 });
    }

    targetUnitId = callerProfile.unit_id;
  }

  // Phase 1 Bottom-Up: showroom_ids (array of codes) replaces single showroom_id
  // Legacy showroom_id still validated for backward compat
  const targetShowroomIds: string[] = Array.isArray(showroom_ids) ? showroom_ids : [];
  if (roleNeedsShowroom(role) && !targetShowroomId && targetShowroomIds.length === 0) {
    return NextResponse.json({ error: 'This role requires at least one showroom' }, { status: 400 });
  }

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

  const { error } = await adminClient.from('thaco_users').update({
    full_name,
    role,
    unit_id: targetUnitId,
    showroom_id: roleNeedsShowroom(role) ? targetShowroomId : null,
    showroom_ids: roleNeedsShowroom(role) ? targetShowroomIds : [],
    brands: brands ?? [],
    is_active,
  }).eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
