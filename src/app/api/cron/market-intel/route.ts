// src/app/api/cron/market-intel/route.ts
// Cron trigger: gọi crawl endpoint mỗi thứ 2 và thứ 5
// GET /api/cron/market-intel (được gọi bởi cron scheduler)

import { NextResponse } from 'next/server';

export const maxDuration = 10;

export async function GET(req: Request) {
  // Bảo vệ endpoint
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002';

  try {
    const res = await fetch(`${baseUrl}/api/market-intel/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
    });

    const data = await res.json();
    return NextResponse.json({ triggered: true, result: data });
  } catch (err: any) {
    return NextResponse.json({ triggered: false, error: err?.message }, { status: 500 });
  }
}
