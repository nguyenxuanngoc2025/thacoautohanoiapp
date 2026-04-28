// src/app/api/market-intel/articles/route.ts
// GET /api/market-intel/articles?status=published&brand=KIA&category=promotion&days=30

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status') ?? 'published';
  const brand    = searchParams.get('brand') ?? '';
  const model    = searchParams.get('model') ?? '';
  const category = searchParams.get('category') ?? '';
  const days     = parseInt(searchParams.get('days') ?? '30', 10);

  let query = supabase
    .from('thaco_market_articles')
    .select('id, title, summary, source_url, source_domain, published_at, crawled_at, category, promo_detail, price_info, comp_brands, comp_models, thaco_brands, thaco_models, status, date_confidence')
    .eq('status', status)
    .order('published_at', { ascending: false })
    .limit(200);

  if (category) query = query.eq('category', category);

  if (days > 0) {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    query = query.gte('published_at', since);
  }

  if (brand) {
    // Filter bởi thaco_brands hoặc comp_brands
    query = query.or(`thaco_brands.cs.{${brand}},comp_brands.cs.{${brand}}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Client-side model filter (array contains)
  const filtered = model
    ? (data ?? []).filter(a =>
        a.comp_models?.includes(model) || a.thaco_models?.includes(model)
      )
    : (data ?? []);

  return NextResponse.json(filtered);
}

export async function PATCH(req: Request) {
  // PATCH /api/market-intel/articles — cập nhật status (approve/archive)
  const { id, status } = await req.json() as { id: string; status: string };
  if (!id || !['published', 'archived', 'review'].includes(status)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const { error } = await supabase
    .from('thaco_market_articles')
    .update({ status })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
