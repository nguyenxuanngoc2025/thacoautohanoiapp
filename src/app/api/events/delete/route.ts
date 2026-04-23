import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const READONLY_ROLES = ['bld', 'finance'];

export async function POST(request: Request) {
  try {
    // Verify caller identity + role
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await serverClient
      .from('thaco_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active) {
      return NextResponse.json({ success: false, error: 'Account inactive or not found' }, { status: 403 });
    }
    if (READONLY_ROLES.includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Role không có quyền xóa sự kiện' }, { status: 403 });
    }

    const payload = await request.json();
    const { id } = payload;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID sự kiện' }, { status: 400 });
    }

    // Dùng service_role_key để bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('thaco_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API/events/delete] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/events/delete] Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
