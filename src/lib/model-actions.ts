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

  // 1. Merge model trong thaco_budget_entries (normalized rows)
  const { data: sourceEntries } = await supabase
    .from('thaco_budget_entries')
    .select('id, unit_id, showroom_id, year, month, channel_code, plan_ns, plan_khqt, plan_gdtd, plan_khd, actual_ns, actual_khqt, actual_gdtd, actual_khd')
    .eq('brand_name', brandName)
    .eq('model_name', sourceName);

  if (sourceEntries && sourceEntries.length > 0) {
    for (const row of sourceEntries) {
      // Kiểm tra xem đã có row target chưa
      const { data: targetRow } = await supabase
        .from('thaco_budget_entries')
        .select('id, plan_ns, plan_khqt, plan_gdtd, plan_khd, actual_ns, actual_khqt, actual_gdtd, actual_khd')
        .eq('unit_id', row.unit_id)
        .eq('showroom_id', row.showroom_id)
        .eq('year', row.year)
        .eq('month', row.month)
        .eq('brand_name', brandName)
        .eq('model_name', targetName)
        .eq('channel_code', row.channel_code)
        .maybeSingle();

      if (targetRow) {
        // Merge: cộng dồn giá trị vào target row
        await supabase.from('thaco_budget_entries').update({
          plan_ns:     (targetRow.plan_ns     || 0) + (row.plan_ns     || 0),
          plan_khqt:   (targetRow.plan_khqt   || 0) + (row.plan_khqt   || 0),
          plan_gdtd:   (targetRow.plan_gdtd   || 0) + (row.plan_gdtd   || 0),
          plan_khd:    (targetRow.plan_khd    || 0) + (row.plan_khd    || 0),
          actual_ns:   (targetRow.actual_ns   || 0) + (row.actual_ns   || 0),
          actual_khqt: (targetRow.actual_khqt || 0) + (row.actual_khqt || 0),
          actual_gdtd: (targetRow.actual_gdtd || 0) + (row.actual_gdtd || 0),
          actual_khd:  (targetRow.actual_khd  || 0) + (row.actual_khd  || 0),
        }).eq('id', targetRow.id);
        // Xóa source row đã merge xong
        await supabase.from('thaco_budget_entries').delete().eq('id', row.id);
      } else {
        // Không có conflict → đổi tên trực tiếp
        await supabase.from('thaco_budget_entries').update({ model_name: targetName }).eq('id', row.id);
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
