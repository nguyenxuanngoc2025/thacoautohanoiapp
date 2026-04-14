import { createClient } from './supabase/client';

export type BudgetPayload = Record<string, number>;
export type BudgetNotes = Record<string, string>;

export interface BudgetPlanData {
  month: number;
  unit_id?: string;
  payload: BudgetPayload;
  notes: BudgetNotes;
  approval_status: 'draft' | 'pending' | 'approved';
}

export async function fetchBudgetPlan(month: number, year: number = 2026): Promise<BudgetPlanData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_budget_plans')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('Error fetching budget plan:', error);
    return null;
  }
  return data;
}

export async function upsertBudgetPlan(
  month: number,
  payload: BudgetPayload,
  notes: BudgetNotes,
  approval_status: string = 'draft',
  unit_id?: string,
  year: number = 2026
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('thaco_budget_plans')
    .upsert({
      month,
      year,
      payload,
      notes,
      approval_status,
      ...(unit_id && { unit_id }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'year,month' });

  if (error) {
    console.error('Error upserting budget plan:', error);
    return false;
  }
  return true;
}

export async function fetchAllBudgetPlans(unit_id?: string): Promise<BudgetPlanData[]> {
  const supabase = createClient();
  let query = supabase.from('thaco_budget_plans').select('*');
  if (unit_id && unit_id !== 'all') {
    query = query.eq('unit_id', unit_id);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching all budget plans:', error);
    return [];
  }
  return data;
}
