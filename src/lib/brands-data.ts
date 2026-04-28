/**
 * brands-data.ts — CRUD layer cho thaco_master_brands & thaco_master_models
 * Single Source of Truth cho cấu hình thương hiệu / dòng xe.
 * Tất cả UI đều đọc từ đây — không hardcode ở bất kỳ nơi nào khác.
 */

import { createClient } from '@/lib/supabase/client';
import { MASTER_BRANDS } from '@/lib/master-data';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MasterBrand {
  id: number;
  name: string;
  code?: string;
  sort_order: number;
  is_active: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface MasterModel {
  id: number;
  brand_name: string;
  name: string;
  code?: string;
  sort_order: number;
  is_active: boolean;
  is_aggregate: boolean;
  aggregate_group: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape dùng trong toàn bộ planning/events UI — giống DEMO_BRANDS cũ */
export interface BrandWithModels {
  name: string;
  color: string | null;
  models: string[];
  modelData: { name: string; is_aggregate: boolean; aggregate_group: string | null }[];
}

// ─── Fallback (khi DB chưa sẵn sàng) ────────────────────────────────────────

const FALLBACK_BRANDS: BrandWithModels[] = MASTER_BRANDS.map(b => ({
  name: b.name,
  color: null,
  models: b.models,
  modelData: b.models.map(m => ({ name: m, is_aggregate: false, aggregate_group: null })),
}));

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchBrandsWithModels(): Promise<BrandWithModels[]> {
  const supabase = createClient();

  const [brandsRes, modelsRes] = await Promise.all([
    supabase
      .from('thaco_master_brands')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('thaco_master_models')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  if (brandsRes.error || modelsRes.error) {
    console.warn('[brands-data] Supabase error, using fallback:', brandsRes.error ?? modelsRes.error);
    return FALLBACK_BRANDS;
  }

  const brands = brandsRes.data as MasterBrand[];
  const models = modelsRes.data as MasterModel[];

  return brands.map(b => ({
    name: b.name,
    color: b.color,
    models: models
      .filter(m => m.brand_name === b.name)
      .map(m => m.name),
    modelData: models
      .filter(m => m.brand_name === b.name)
      .map(m => ({ name: m.name, is_aggregate: m.is_aggregate, aggregate_group: m.aggregate_group })),
  }));
}

export async function fetchAllBrandsRaw(): Promise<MasterBrand[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_master_brands')
    .select('*')
    .order('sort_order');
  if (error) { console.error(error); return []; }
  return data as MasterBrand[];
}

export async function fetchModelsForBrand(brandName: string): Promise<MasterModel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_master_models')
    .select('*')
    .eq('brand_name', brandName)
    .order('sort_order');
  if (error) { console.error(error); return []; }
  return data as MasterModel[];
}

// ─── Brand CRUD ──────────────────────────────────────────────────────────────

export async function createBrand(brand: {
  name: string; code?: string; color?: string; sort_order: number;
}): Promise<MasterBrand | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_master_brands')
    .insert({ ...brand, is_active: true })
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return data as MasterBrand;
}

export async function updateBrand(id: number, updates: Partial<{
  name: string; code: string; color: string; sort_order: number; is_active: boolean;
}>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('thaco_master_brands')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

export async function deleteBrand(id: number): Promise<boolean> {
  const supabase = createClient();
  // Soft delete — giữ lại data lịch sử
  const { error } = await supabase
    .from('thaco_master_brands')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

export async function reorderBrands(orderedIds: number[]): Promise<boolean> {
  const supabase = createClient();
  const updates = orderedIds.map((id, idx) =>
    supabase.from('thaco_master_brands').update({ sort_order: idx + 1 }).eq('id', id)
  );
  const results = await Promise.all(updates);
  return results.every(r => !r.error);
}

// ─── Model CRUD ──────────────────────────────────────────────────────────────

export async function createModel(model: {
  brand_name: string; name: string; code?: string; sort_order: number; is_aggregate?: boolean; aggregate_group?: string | null;
}): Promise<MasterModel | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_master_models')
    .insert({ ...model, is_active: true, is_aggregate: model.is_aggregate ?? false, aggregate_group: model.aggregate_group ?? null })
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return data as MasterModel;
}

export async function updateModel(id: number, updates: Partial<{
  name: string; code: string; sort_order: number; is_active: boolean; is_aggregate: boolean; aggregate_group: string | null;
}>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('thaco_master_models')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

export async function deleteModel(id: number): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('thaco_master_models')
    .delete()
    .eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

export async function reorderModels(brandName: string, orderedIds: number[]): Promise<boolean> {
  const supabase = createClient();
  const updates = orderedIds.map((id, idx) =>
    supabase.from('thaco_master_models').update({ sort_order: idx + 1 }).eq('id', id)
  );
  const results = await Promise.all(updates);
  return results.every(r => !r.error);
}
