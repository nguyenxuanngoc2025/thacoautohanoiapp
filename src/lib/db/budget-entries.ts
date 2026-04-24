import { createClient } from '@/lib/supabase/client';
import type {
  BudgetEntryRow,
  ViewBudgetByShowroom,
  ViewBudgetByChannel,
  ViewBudgetByBrand,
  ViewBudgetByShowroomBrand,
  ViewBudgetMaster,
  ViewKpiByShowroom,
  CellData,
} from '@/types/database';

// Key separator — avoids collision with brand/model names containing dashes
// Format: "brand_name|||model_name|||channel_code|||metric_code"
// Example: "KIA|||New Carnival|||FB|||ns"
const SEP = '|||';

// ─── Key Helpers ─────────────────────────────────────────────────────────────

export function makeCellKey(
  brandName: string,
  modelName: string,
  channelCode: string,
  metric: 'ns' | 'khqt' | 'gdtd' | 'khd'
): string {
  return [brandName, modelName, channelCode, metric].join(SEP);
}

export function parseCellKey(key: string): {
  brandName: string;
  modelName: string;
  channelCode: string;
  metric: string;
} {
  const parts = key.split(SEP);
  return {
    brandName: parts[0] ?? '',
    modelName: parts[1] ?? '',
    channelCode: parts[2] ?? '',
    metric: parts[3] ?? '',
  };
}

// ─── Row → CellData Conversion ───────────────────────────────────────────────

const METRICS = ['ns', 'khqt', 'gdtd', 'khd'] as const;
type Metric = (typeof METRICS)[number];

export function rowsToPlanCellData(rows: BudgetEntryRow[]): CellData {
  const result: CellData = {};
  for (const row of rows) {
    for (const metric of METRICS) {
      const key = makeCellKey(row.brand_name, row.model_name, row.channel_code, metric);
      result[key] = row[`plan_${metric}` as keyof BudgetEntryRow] as number | null;
    }
  }
  return result;
}

export function rowsToActualCellData(rows: BudgetEntryRow[]): CellData {
  const result: CellData = {};
  for (const row of rows) {
    for (const metric of METRICS) {
      const key = makeCellKey(row.brand_name, row.model_name, row.channel_code, metric);
      result[key] = row[`actual_${metric}` as keyof BudgetEntryRow] as number | null;
    }
  }
  return result;
}

// ─── CellData → Entries for Upsert ───────────────────────────────────────────

interface EntryInput {
  unit_id: string;
  showroom_id: string;
  year: number;
  month: number;
  brand_name: string;
  model_name: string;
  channel_code: string;
  plan_ns?: number | null;
  plan_khqt?: number | null;
  plan_gdtd?: number | null;
  plan_khd?: number | null;
  actual_ns?: number | null;
  actual_khqt?: number | null;
  actual_gdtd?: number | null;
  actual_khd?: number | null;
  plan_source?: string;
  actual_source?: string;
}

type GroupedEntry = Record<string, EntryInput>;

export function cellDataToEntries(
  cellData: CellData,
  unitId: string,
  showroomId: string,
  year: number,
  month: number,
  mode: 'plan' | 'actual'
): EntryInput[] {
  const grouped: GroupedEntry = {};

  for (const [key, value] of Object.entries(cellData)) {
    const { brandName, modelName, channelCode, metric } = parseCellKey(key);
    if (!METRICS.includes(metric as Metric)) continue;

    const rowKey = [brandName, modelName, channelCode].join(SEP);
    if (!grouped[rowKey]) {
      grouped[rowKey] = {
        unit_id: unitId,
        showroom_id: showroomId,
        year,
        month,
        brand_name: brandName,
        model_name: modelName,
        channel_code: channelCode,
        plan_source: 'manual',
        actual_source: 'manual',
      };
    }

    const col = `${mode}_${metric}` as keyof EntryInput;
    (grouped[rowKey] as unknown as Record<string, unknown>)[col] = value;
  }

  return Object.values(grouped);
}

// ─── Fetch Functions ──────────────────────────────────────────────────────────

export async function fetchBudgetEntriesByShowroom(
  showroomId: string,
  year: number,
  month: number
): Promise<BudgetEntryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_budget_entries')
    .select('*')
    .eq('showroom_id', showroomId)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
  return (data ?? []) as BudgetEntryRow[];
}

export async function fetchBudgetEntriesByUnit(
  unitId: string,
  year: number,
  month: number
): Promise<BudgetEntryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_budget_entries')
    .select('*')
    .eq('unit_id', unitId)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
  return (data ?? []) as BudgetEntryRow[];
}

// Fetch tất cả entries của nhiều showrooms (dùng cho aggregate view)
// Mạnh hơn fetchBudgetEntriesByUnit vì không phụ thuộc unit_id trong entries
export async function fetchBudgetEntriesByShowroomIds(
  showroomIds: string[],
  year: number,
  month: number
): Promise<BudgetEntryRow[]> {
  if (showroomIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_budget_entries')
    .select('*')
    .in('showroom_id', showroomIds)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
  return (data ?? []) as BudgetEntryRow[];
}

export async function fetchViewBudgetByShowroom(
  unitId: string | null,
  year: number
): Promise<ViewBudgetByShowroom[]> {
  const supabase = createClient();
  let query = supabase.from('v_budget_by_showroom').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) {
    console.error('[fetchViewBudgetByShowroom] error:', error.message, error.code, { unitId, year });
    throw error;
  }
  console.log('[fetchViewBudgetByShowroom] rows:', data?.length, { unitId, year });
  return (data ?? []) as ViewBudgetByShowroom[];
}

export async function fetchViewKpiByShowroom(
  unitId: string | null,
  year: number
): Promise<ViewKpiByShowroom[]> {
  const supabase = createClient();
  let query = supabase.from('v_kpi_by_showroom_monthly').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ViewKpiByShowroom[];
}

export async function fetchViewBudgetByChannel(
  unitId: string | null,
  year: number
): Promise<ViewBudgetByChannel[]> {
  const supabase = createClient();
  let query = supabase.from('v_budget_by_channel').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ViewBudgetByChannel[];
}

export async function fetchViewBudgetByBrand(
  unitId: string | null,
  year: number
): Promise<ViewBudgetByBrand[]> {
  const supabase = createClient();
  let query = supabase.from('v_budget_by_brand').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ViewBudgetByBrand[];
}

export async function fetchViewBudgetByShowroomBrand(
  unitId: string | null,
  year: number
): Promise<ViewBudgetByShowroomBrand[]> {
  const supabase = createClient();
  let query = supabase.from('v_budget_by_showroom_brand').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ViewBudgetByShowroomBrand[];
}

export async function fetchViewBudgetMaster(
  unitId: string | null,
  year: number
): Promise<ViewBudgetMaster[]> {
  const supabase = createClient();
  let query = supabase.from('v_budget_master').select('*').eq('year', year);
  if (unitId) query = query.eq('unit_id', unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ViewBudgetMaster[];
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export async function upsertBudgetEntries(entries: EntryInput[]): Promise<void> {
  if (entries.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.rpc('rpc_upsert_budget_entries', {
    p_entries: entries,
  });
  if (error) throw error;
}

// ─── Submit Plan ──────────────────────────────────────────────────────────────

export async function submitPlan(
  unitId: string,
  showroomId: string,
  year: number,
  month: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('rpc_submit_plan', {
    p_unit_id: unitId,
    p_showroom_id: showroomId,
    p_year: year,
    p_month: month,
  });
  if (error) throw error;
}
