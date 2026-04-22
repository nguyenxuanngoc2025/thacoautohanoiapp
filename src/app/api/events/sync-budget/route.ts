import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type SyncBudgetBody = {
  showroom_code?: string;
  month?: number;
  year?: number;
  unit_id?: string;
};

type DbModelRow = {
  brand_name: string;
  name: string;
  is_aggregate?: boolean | null;
  aggregate_group?: string | null;
};

type DbBrand = {
  name: string;
  models: string[];
  modelData: { name: string; is_aggregate?: boolean | null; aggregate_group?: string | null }[];
};

/** Resolve which (brand, model) pairs to target from a flat brands[] array on the event. */
function resolveTargets(
  evBrands: string[],
  dbBrands: DbBrand[]
): { brand: string; model: string }[] {
  const selectedBrandNames = new Set(
    dbBrands
      .map((b) => b.name)
      .filter((name) => evBrands.includes(name) && !/^DVPT\b/i.test(name))
  );

  return dbBrands.flatMap((brand) => {
    if (!selectedBrandNames.has(brand.name)) return [];

    const selectableModels = (brand.modelData ?? brand.models.map((n) => ({ name: n, is_aggregate: false, aggregate_group: null })))
      .filter((m) => !m.is_aggregate)
      .map((m) => m.name);

    const explicitlySelected = selectableModels.filter((m) => evBrands.includes(m));

    if (explicitlySelected.length === 0) {
      if (selectableModels.length === 0) return [{ brand: brand.name, model: brand.name }];
      return selectableModels.map((model) => ({ brand: brand.name, model }));
    }

    return explicitlySelected.map((model) => ({ brand: brand.name, model }));
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncBudgetBody;
    const { showroom_code, month, year } = body;
    let { unit_id } = body;

    if (!showroom_code || !month || !year) {
      return NextResponse.json(
        { success: false, error: 'Thiếu showroom_code, month hoặc year' },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // ── Resolve showroom_id (UUID) + unit_id ────────────────────────────────────
    const { data: showroomRow, error: srErr } = await supabase
      .from('thaco_showrooms')
      .select('id, unit_id')
      .eq('code', showroom_code)
      .single();

    if (srErr || !showroomRow) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy showroom với code "${showroom_code}"` },
        { status: 400 },
      );
    }

    const showroom_id: string = showroomRow.id;
    if (!unit_id || unit_id === 'all') {
      unit_id = showroomRow.unit_id;
    }

    // ── Fetch master brands + models ────────────────────────────────────────────
    const [brandsRes, modelsRes] = await Promise.all([
      supabase.from('thaco_master_brands').select('name').eq('is_active', true).order('sort_order'),
      supabase.from('thaco_master_models').select('brand_name, name, is_aggregate, aggregate_group').eq('is_active', true).order('sort_order'),
    ]);

    if (brandsRes.error || modelsRes.error || !brandsRes.data || !modelsRes.data) {
      return NextResponse.json(
        { success: false, error: 'Không lấy được master brands/models từ DB' },
        { status: 500 },
      );
    }

    const modelRows = modelsRes.data as DbModelRow[];
    const dbBrands: DbBrand[] = brandsRes.data.map((brand: { name: string }) => ({
      name: brand.name,
      models: modelRows.filter((m) => m.brand_name === brand.name).map((m) => m.name),
      modelData: modelRows
        .filter((m) => m.brand_name === brand.name)
        .map((m) => ({
          name: m.name,
          is_aggregate: m.is_aggregate ?? false,
          aggregate_group: m.aggregate_group ?? null,
        })),
    }));

    // ── Fetch events for this showroom + month + year ───────────────────────────
    const { data: rows, error: eventsErr } = await supabase
      .from('thaco_events')
      .select('*')
      .eq('showroom_code', showroom_code);

    if (eventsErr) throw eventsErr;

    const eventsInMonth = (rows ?? []).filter((row: { date?: string | null }) => {
      if (!row.date) return false;
      const eventMonth = row.date.includes('/')
        ? parseInt(row.date.split('/')[1] ?? '', 10)
        : parseInt(row.date.split('-')[1] ?? '', 10);
      const eventYear = row.date.includes('/')
        ? parseInt(row.date.split('/')[2] ?? '', 10)
        : parseInt(row.date.split('-')[0] ?? '', 10);
      return eventMonth === month && eventYear === year;
    });

    // ── Aggregate event KPIs per (brand_name, model_name) ──────────────────────
    type AggKey = string; // "brand||model"
    const agg: Map<AggKey, { plan_ns: number; plan_khqt: number; plan_gdtd: number; plan_khd: number }> = new Map();

    for (const eventRow of eventsInMonth) {
      const evBrands: string[] = Array.isArray(eventRow.brands) ? eventRow.brands : [];
      const budget = Number(eventRow.budget) || 0;
      const leads  = Number(eventRow.leads)  || 0;
      const gdtd   = Number(eventRow.gdtd)   || 0;
      const deals  = Number(eventRow.deals)  || 0;

      const targets = resolveTargets(evBrands, dbBrands);
      if (targets.length === 0) continue;

      const fraction = 1 / targets.length;

      for (const { brand, model } of targets) {
        const key: AggKey = `${brand}||${model}`;
        const existing = agg.get(key) ?? { plan_ns: 0, plan_khqt: 0, plan_gdtd: 0, plan_khd: 0 };
        agg.set(key, {
          plan_ns:   existing.plan_ns   + budget * fraction,
          plan_khqt: existing.plan_khqt + leads  * fraction,
          plan_gdtd: existing.plan_gdtd + gdtd   * fraction,
          plan_khd:  existing.plan_khd  + deals  * fraction,
        });
      }
    }

    // ── Delete old event-sourced entries for this scope, then upsert new ones ──
    // First, delete existing "event"-sourced rows for this showroom+month+year
    // so that removed events are properly cleaned up.
    const { error: deleteErr } = await supabase
      .from('thaco_budget_entries')
      .delete()
      .eq('showroom_id', showroom_id)
      .eq('year', year)
      .eq('month', month)
      .eq('channel_code', 'event')
      .eq('plan_source', 'event');

    if (deleteErr) throw deleteErr;

    // Build upsert rows
    if (agg.size > 0) {
      const upsertRows = Array.from(agg.entries()).map(([key, kpis]) => {
        const [brand_name, model_name] = key.split('||');
        return {
          unit_id,
          showroom_id,
          year,
          month,
          brand_name,
          model_name,
          channel_code: 'event',
          plan_ns:   Math.round(kpis.plan_ns   * 10) / 10,
          plan_khqt: Math.round(kpis.plan_khqt),
          plan_gdtd: Math.round(kpis.plan_gdtd),
          plan_khd:  Math.round(kpis.plan_khd),
          plan_source:  'event',
          plan_status:  'draft',
          updated_at:   new Date().toISOString(),
        };
      });

      const { error: upsertErr } = await supabase
        .from('thaco_budget_entries')
        .upsert(upsertRows, {
          onConflict: 'unit_id,showroom_id,year,month,brand_name,model_name,channel_code',
          ignoreDuplicates: false,
        });

      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({ success: true, count: eventsInMonth.length, rows: agg.size });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown sync-budget error';
    console.error('[api/events/sync-budget] Exception:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
