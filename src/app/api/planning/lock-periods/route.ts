import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unit_id = searchParams.get('unit_id');
  const year = searchParams.get('year');

  if (!unit_id || !year) {
    return NextResponse.json({ periods: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('thaco_lock_periods')
    .select('unit_id, year, month, entry_type, is_locked, locked_by_name, locked_at')
    .eq('unit_id', unit_id)
    .eq('year', parseInt(year));

  if (error) {
    console.error('[API/planning/lock-periods]', error);
    return NextResponse.json({ periods: [] });
  }

  return NextResponse.json({ periods: data || [] });
}
