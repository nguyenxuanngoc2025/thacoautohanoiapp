import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type UserRole } from '@/types/database';

const COMPANY_ADMIN_RESETTABLE_ROLES: UserRole[] = [
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
    return NextResponse.json({ error: 'Only Super Admin or PT Marketing Cty can reset passwords' }, { status: 403 });
  }

  const { userId, newPassword } = await request.json();

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Missing userId or newPassword' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  if (callerProfile.role === 'pt_mkt_cty') {
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
      !COMPANY_ADMIN_RESETTABLE_ROLES.includes(targetProfile.role as UserRole)
    ) {
      return NextResponse.json({ error: 'You cannot reset this user password' }, { status: 403 });
    }
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
