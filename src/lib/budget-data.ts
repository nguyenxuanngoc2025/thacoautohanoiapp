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

export async function fetchBudgetPlan(month: number): Promise<BudgetPlanData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_budget_plans')
    .select('*')
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
    }, { onConflict: 'month,year' });

  if (error) {
    console.error('Error upserting budget plan:', error);
    return false;
  }
  return true;
}

export async function fetchAllBudgetPlans(): Promise<BudgetPlanData[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('thaco_budget_plans').select('*');
  if (error) {
    console.error('Error fetching all budget plans:', error);
    return [];
  }
  return data;
}
