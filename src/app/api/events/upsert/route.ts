import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// IMPORTANT: Do not remove this, required for API route handling
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
      return NextResponse.json({ success: false, error: 'Role không có quyền tạo/sửa sự kiện' }, { status: 403 });
    }

    const payload = await request.json();

    // Dùng service_role_key để bỏ qua toàn bộ RLS, giải quyết dứt điểm các lỗi CORS/Client chặn
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Bỏ id nếu onConflict là column khác, nhưng ở đây đang upsert dựa vào ID
    const { data, error } = await supabase
      .from('thaco_events')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[API/events/upsert] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[API/events/upsert] Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
