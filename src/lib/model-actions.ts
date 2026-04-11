"use server";

import { createClient } from '@/lib/supabase/server';

export async function mergeAndDeleteModelAction(
  sourceId: number, 
  targetId: number, 
  brandName: string, 
  sourceName: string, 
  targetName: string
) {
  const supabase = await createClient();

  // 1. Dữ liệu Kế hoạch Ngân sách (thaco_budget_plans)
  const { data: plans } = await supabase.from('thaco_budget_plans').select('*');
  
  if (plans) {
    for (const plan of plans) {
      if (!plan.payload) continue;
      let hasChanges = false;
      const newPayload = { ...plan.payload };
      
      const sourcePrefix = `${brandName}-${sourceName}-`;
      const targetPrefix = `${brandName}-${targetName}-`;

      for (const key of Object.keys(newPayload)) {
        if (key.startsWith(sourcePrefix)) {
          // Ví dụ: "KIA-K3-Facebook-GDTD" -> "KIA-Cerato-Facebook-GDTD"
          const suffix = key.substring(sourcePrefix.length);
          const newKey = `${targetPrefix}${suffix}`;
          
          // Cộng dồn giá trị
          const sourceValue = newPayload[key] || 0;
          const targetValue = newPayload[newKey] || 0;
          
          newPayload[newKey] = sourceValue + targetValue;
          delete newPayload[key];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await supabase
          .from('thaco_budget_plans')
          .update({ payload: newPayload })
          .eq('month', plan.month);
      }
    }
  }

  // 2. Dữ liệu sự kiện (thaco_events)
  // brands là string[] — chứa mixed brand names + model names (VD: ["KIA", "K3", "Mazda"])
  const { data: events } = await supabase.from('thaco_events').select('id, brands');

  if (events) {
    for (const ev of events) {
      if (!ev.brands || !Array.isArray(ev.brands)) continue;

      const idx = (ev.brands as string[]).indexOf(sourceName);
      if (idx === -1) continue;

      // Thay sourceName → targetName, bỏ trùng lặp nếu targetName đã tồn tại
      const newBrands = (ev.brands as string[])
        .map((b: string) => b === sourceName ? targetName : b)
        .filter((b: string, i: number, arr: string[]) => arr.indexOf(b) === i);

      await supabase
        .from('thaco_events')
        .update({ brands: newBrands })
        .eq('id', ev.id);
    }
  }

  // 3. Xóa dòng xe cũ (Hard Delete)
  const { error: deleteError } = await supabase
    .from('thaco_master_models')
    .delete()
    .eq('id', sourceId);

  if (deleteError) {
    console.error('Failed to delete model after merging', deleteError);
    return { success: false, error: deleteError.message };
  }

  return { success: true };
}
