import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showroom_id = searchParams.get('showroom_id');
  const unit_id = searchParams.get('unit_id');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const entry_type = searchParams.get('entry_type') || 'plan';

  if (!showroom_id || !year || !month) {
    return NextResponse.json({ submission: 'draft', locked: false });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [subResult, lockResult] = await Promise.all([
    supabase
      .from('thaco_plan_submissions')
      .select('status')
      .eq('showroom_id', showroom_id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .eq('entry_type', entry_type)
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle(),
    unit_id
      ? supabase
          .from('thaco_lock_periods')
          .select('is_locked')
          .eq('unit_id', unit_id)
          .eq('year', parseInt(year))
          .eq('month', parseInt(month))
          .eq('entry_type', entry_type)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return NextResponse.json({
    submission: subResult.data?.status || 'draft',
    locked: lockResult.data?.is_locked || false,
  });
}
