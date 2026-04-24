/**
 * use-data.ts — SWR hooks cho global data cache
 *
 * Foundation Rebuild (2026-04-22): Chỉ còn các hooks dựa trên normalized
 * thaco_budget_entries + Supabase views. Legacy hooks (useBudgetPlans,
 * useActualEntries, v.v.) đã bị xóa cùng budget-data.ts / actual-data.ts.
 */

import useSWR, { mutate as globalMutate, mutate as swrMutate } from 'swr';
import {
  fetchEventsFromDB,
  fetchEventsByShowroom,
  type EventsByMonth,
} from './events-data';
import {
  fetchViewBudgetByShowroom,
  fetchViewBudgetByChannel,
  fetchViewBudgetByBrand,
  fetchViewBudgetByShowroomBrand,
  fetchViewBudgetMaster,
  fetchViewKpiByShowroom,
  fetchBudgetEntriesByShowroom,
  fetchBudgetEntriesByUnit,
  fetchBudgetEntriesByShowroomIds,
} from '@/lib/db/budget-entries';
import type {
  ViewBudgetByShowroom,
  ViewBudgetByChannel,
  ViewBudgetByBrand,
  ViewBudgetByShowroomBrand,
  ViewBudgetMaster,
  ViewKpiByShowroom,
  BudgetEntryRow,
} from '@/types/database';

// ── Shared SWR options ──────────────────────────────────────────────────────────
const BASE_OPTS = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  dedupingInterval: 0,   // mount mới → fetch ngay, không cache theo thời gian
  keepPreviousData: true,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useEventsData(unitId?: string) {
  const key = ['events', unitId ?? 'all'];
  return useSWR<EventsByMonth>(key, () => fetchEventsFromDB(unitId), BASE_OPTS);
}

/**
 * Events của 1 showroom cụ thể (per-month bucket).
 */
export function useEventsByShowroom(
  showroomCode: string | null | undefined,
  unitId?: string,
) {
  const key = showroomCode
    ? (['events_sr', unitId ?? 'all', showroomCode] as const)
    : null;
  return useSWR<EventsByMonth>(
    key,
    () => fetchEventsByShowroom(showroomCode as string, unitId),
    BASE_OPTS,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const invalidateEventsData = (unitId?: string) =>
  globalMutate(['events', unitId ?? 'all']);

export const invalidateEventsByShowroom = (showroomCode: string, unitId?: string) => {
  globalMutate(['events_sr', unitId ?? 'all', showroomCode]);
  globalMutate(['events', unitId ?? 'all']);
};

// ─── Foundation Rebuild: New View-Based Hooks ─────────────────────────────────

export function useViewBudgetByShowroom(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByShowroom[]>(
    ['v_budget_by_showroom', unitId ?? 'all', year],
    () => fetchViewBudgetByShowroom(unitId, year),
    BASE_OPTS
  );
}

export function useViewKpiByShowroom(unitId: string | null, year: number) {
  return useSWR<ViewKpiByShowroom[]>(
    ['v_kpi_by_showroom_monthly', unitId ?? 'all', year],
    () => fetchViewKpiByShowroom(unitId, year),
    BASE_OPTS
  );
}

export function useViewBudgetByChannel(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByChannel[]>(
    ['v_budget_by_channel', unitId ?? 'all', year],
    () => fetchViewBudgetByChannel(unitId, year),
    BASE_OPTS
  );
}

export function useViewBudgetByBrand(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByBrand[]>(
    ['v_budget_by_brand', unitId ?? 'all', year],
    () => fetchViewBudgetByBrand(unitId, year),
    BASE_OPTS
  );
}

export function useViewBudgetByShowroomBrand(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByShowroomBrand[]>(
    ['v_budget_by_showroom_brand', unitId ?? 'all', year],
    () => fetchViewBudgetByShowroomBrand(unitId, year),
    BASE_OPTS
  );
}

export function useViewBudgetMaster(unitId: string | null, year: number) {
  return useSWR<ViewBudgetMaster[]>(
    ['v_budget_master', unitId ?? 'all', year],
    () => fetchViewBudgetMaster(unitId, year),
    BASE_OPTS
  );
}

export function useBudgetEntriesByShowroom(
  showroomId: string | null,
  year: number,
  month: number
) {
  return useSWR<BudgetEntryRow[]>(
    showroomId ? ['budget_entries', showroomId, year, month] : null,
    () => fetchBudgetEntriesByShowroom(showroomId!, year, month),
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 3_000 }
  );
}

export function useBudgetEntriesByUnit(
  unitId: string | null,
  year: number,
  month: number
) {
  return useSWR<BudgetEntryRow[]>(
    unitId ? ['budget_entries_unit', unitId, year, month] : null,
    () => fetchBudgetEntriesByUnit(unitId!, year, month),
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 3_000 }
  );
}

// Fetch entries cho nhiều showrooms cùng lúc (aggregate view)
// Không phụ thuộc unit_id trong entries — dùng showroom_id[] thay thế
export function useBudgetEntriesByShowroomIds(
  showroomIds: string[] | null,
  year: number,
  month: number
) {
  // Stable key: sort để tránh cache miss khi thứ tự thay đổi
  const idsKey = showroomIds ? [...showroomIds].sort().join(',') : null;
  return useSWR<BudgetEntryRow[]>(
    idsKey ? ['budget_entries_srs', idsKey, year, month] : null,
    () => fetchBudgetEntriesByShowroomIds(showroomIds!, year, month),
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 3_000 }
  );
}

// Invalidate all budget-related caches after a write
export function invalidateBudgetCaches(unitId: string, showroomId: string, year: number, month: number) {
  swrMutate(['v_budget_by_showroom', unitId, year]);
  swrMutate(['v_kpi_by_showroom_monthly', unitId, year]);
  swrMutate(['v_budget_by_channel', unitId, year]);
  swrMutate(['v_budget_by_brand', unitId, year]);
  swrMutate(['budget_entries', showroomId, year, month]);
  // Invalidate aggregate cache (key bao gồm showroom_id này)
  swrMutate(
    (key) => Array.isArray(key) && key[0] === 'budget_entries_srs' && typeof key[1] === 'string' && key[1].includes(showroomId),
    undefined,
    { revalidate: true },
  );
}
