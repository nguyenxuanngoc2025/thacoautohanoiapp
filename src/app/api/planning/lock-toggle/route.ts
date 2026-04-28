import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { unit_id, year, month, entry_type = 'plan', is_locked, locker_name } = await request.json();

    if (!unit_id || !year || !month) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('thaco_lock_periods').upsert({
      unit_id,
      year,
      month,
      entry_type,
      is_locked: !!is_locked,
      locked_by_name: locker_name || '',
      locked_at: is_locked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'unit_id,year,month,entry_type' });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/planning/lock-toggle]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
