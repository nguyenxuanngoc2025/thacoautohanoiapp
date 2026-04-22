/**
 * use-data.ts — SWR hooks cho global data cache
 *
 * Kiến trúc Bottom-Up (Phase 1):
 * - Single SR view: useBudgetPlansByShowroom / useActualEntriesByShowroom / useEventsByShowroom
 *   → Key include showroom_code → cache tách riêng từng SR → switch SR không thả cache
 * - Aggregate view: useAggregateBudgetPlans / useAggregateActualEntries
 *   → Chỉ lấy records status ∈ (submitted, approved) → rồi caller sum
 * - Legacy hooks (useBudgetPlans, useActualEntries, useEventsData) giữ cho dashboard/reports
 *   (các trang này vẫn đọc full để sum toàn unit).
 */

import useSWR, { mutate as globalMutate, mutate as swrMutate } from 'swr';
import {
  fetchAllBudgetPlans,
  fetchBudgetPlansByShowroom,
  fetchAggregateBudgetPlans,
  type BudgetPlanData,
} from './budget-data';
import {
  fetchAllActualEntries,
  fetchActualEntriesByShowroom,
  fetchAggregateActualEntries,
  computeHistoricalCPL,
  type ActualEntryData,
} from './actual-data';
import {
  fetchEventsFromDB,
  fetchEventsByShowroom,
  type EventsByMonth,
} from './events-data';
import {
  fetchViewBudgetByShowroom,
  fetchViewBudgetByChannel,
  fetchViewBudgetByBrand,
  fetchViewKpiByShowroom,
  fetchBudgetEntriesByShowroom,
} from '@/lib/db/budget-entries';
import type {
  ViewBudgetByShowroom,
  ViewBudgetByChannel,
  ViewBudgetByBrand,
  ViewKpiByShowroom,
  BudgetEntryRow,
} from '@/types/database';

// ── Shared SWR options ──────────────────────────────────────────────────────────
const BASE_OPTS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const;

// CPL cache dài hơn (ít thay đổi)
const CPL_OPTS = { ...BASE_OPTS, dedupingInterval: 300_000, keepPreviousData: true } as const;

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY HOOKS — giữ cho dashboard / reports (các trang không phải planning)
// ─────────────────────────────────────────────────────────────────────────────

export function useBudgetPlans(unitId?: string, year: number = 2026) {
  const key = ['budget_plans', unitId ?? 'all', year];
  return useSWR<BudgetPlanData[]>(key, () => fetchAllBudgetPlans(unitId, year), BASE_OPTS);
}

export function useActualEntries(year: number, unitId?: string) {
  const key = ['actual_entries', year, unitId ?? 'all'];
  return useSWR<ActualEntryData[]>(key, () => fetchAllActualEntries(year, unitId), BASE_OPTS);
}

export function useEventsData(unitId?: string) {
  const key = ['events', unitId ?? 'all'];
  return useSWR<EventsByMonth>(key, () => fetchEventsFromDB(unitId), BASE_OPTS);
}

export function useHistoricalCPL(year: number, unitId?: string, showroomCode?: string) {
  const key = ['historical_cpl', year, unitId ?? 'all', showroomCode ?? 'ALL'];
  return useSWR<Record<string, number>>(
    key,
    () => computeHistoricalCPL(year, unitId, showroomCode),
    CPL_OPTS,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — PER-SHOWROOM HOOKS (dùng cho /planning)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Budget plans của 1 showroom cụ thể — dùng khi user đứng ở 1 SR.
 * Khi showroomCode đổi (switch SR), SWR dùng cache riêng → không re-fetch.
 */
export function useBudgetPlansByShowroom(
  showroomCode: string | null | undefined,
  year: number = 2026,
  unitId?: string,
) {
  const key = showroomCode
    ? (['budget_plans_sr', unitId ?? 'all', showroomCode, year] as const)
    : null;
  return useSWR<BudgetPlanData[]>(
    key,
    () => fetchBudgetPlansByShowroom(showroomCode as string, year, unitId),
    BASE_OPTS,
  );
}

/**
 * Actual entries của 1 showroom cụ thể.
 */
export function useActualEntriesByShowroom(
  showroomCode: string | null | undefined,
  year: number,
  unitId?: string,
) {
  const key = showroomCode
    ? (['actual_entries_sr', unitId ?? 'all', showroomCode, year] as const)
    : null;
  return useSWR<ActualEntryData[]>(
    key,
    () => fetchActualEntriesByShowroom(showroomCode as string, year, unitId),
    BASE_OPTS,
  );
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
// AGGREGATE HOOKS — xem "Tất cả SR" (read-only sum submitted/approved)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate budget plans — chỉ records đã submitted/approved.
 * @param showroomCodes [] = tất cả SR trong unit (admin view)
 * @param enabled false = tạm không fetch (ví dụ chưa chọn view mode)
 */
export function useAggregateBudgetPlans(
  showroomCodes: string[],
  year: number = 2026,
  unitId?: string,
  enabled: boolean = true,
) {
  const codesKey = [...showroomCodes].sort().join(',') || 'all';
  const key = enabled
    ? (['budget_plans_agg', unitId ?? 'all', codesKey, year] as const)
    : null;
  return useSWR<BudgetPlanData[]>(
    key,
    () => fetchAggregateBudgetPlans(showroomCodes, year, unitId),
    BASE_OPTS,
  );
}

export function useAggregateActualEntries(
  showroomCodes: string[],
  year: number,
  unitId?: string,
  enabled: boolean = true,
) {
  const codesKey = [...showroomCodes].sort().join(',') || 'all';
  const key = enabled
    ? (['actual_entries_agg', unitId ?? 'all', codesKey, year] as const)
    : null;
  return useSWR<ActualEntryData[]>(
    key,
    () => fetchAggregateActualEntries(showroomCodes, year, unitId),
    BASE_OPTS,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const invalidateBudgetPlans = (unitId?: string, year: number = 2026) =>
  globalMutate(['budget_plans', unitId ?? 'all', year]);

export const invalidateBudgetPlansByShowroom = (
  showroomCode: string,
  year: number = 2026,
  unitId?: string,
) => {
  // Invalidate cả per-SR hook và aggregate (ảnh hưởng chéo)
  globalMutate(['budget_plans_sr', unitId ?? 'all', showroomCode, year]);
  globalMutate(
    (key) => Array.isArray(key) && key[0] === 'budget_plans_agg' && key[1] === (unitId ?? 'all') && key[3] === year,
    undefined,
    { revalidate: true },
  );
  // Cũng invalidate legacy hook
  globalMutate(['budget_plans', unitId ?? 'all', year]);
};

export const invalidateActualEntries = (year: number, unitId?: string) =>
  globalMutate(['actual_entries', year, unitId ?? 'all']);

export const invalidateActualEntriesByShowroom = (
  showroomCode: string,
  year: number,
  unitId?: string,
) => {
  globalMutate(['actual_entries_sr', unitId ?? 'all', showroomCode, year]);
  globalMutate(
    (key) => Array.isArray(key) && key[0] === 'actual_entries_agg' && key[1] === (unitId ?? 'all') && key[3] === year,
    undefined,
    { revalidate: true },
  );
  globalMutate(['actual_entries', year, unitId ?? 'all']);
};

export const invalidateEventsData = (unitId?: string) =>
  globalMutate(['events', unitId ?? 'all']);

export const invalidateEventsByShowroom = (showroomCode: string, unitId?: string) => {
  globalMutate(['events_sr', unitId ?? 'all', showroomCode]);
  globalMutate(['events', unitId ?? 'all']);
};

export const invalidateHistoricalCPL = (year: number, unitId?: string, showroomCode?: string) =>
  globalMutate(['historical_cpl', year, unitId ?? 'all', showroomCode ?? 'ALL']);

// ─── Foundation Rebuild: New View-Based Hooks ─────────────────────────────────

export function useViewBudgetByShowroom(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByShowroom[]>(
    unitId ? ['v_budget_by_showroom', unitId, year] : null,
    () => fetchViewBudgetByShowroom(unitId!, year),
    { revalidateOnFocus: false }
  );
}

export function useViewKpiByShowroom(unitId: string | null, year: number) {
  return useSWR<ViewKpiByShowroom[]>(
    unitId ? ['v_kpi_by_showroom_monthly', unitId, year] : null,
    () => fetchViewKpiByShowroom(unitId!, year),
    { revalidateOnFocus: false }
  );
}

export function useViewBudgetByChannel(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByChannel[]>(
    unitId ? ['v_budget_by_channel', unitId, year] : null,
    () => fetchViewBudgetByChannel(unitId!, year),
    { revalidateOnFocus: false }
  );
}

export function useViewBudgetByBrand(unitId: string | null, year: number) {
  return useSWR<ViewBudgetByBrand[]>(
    unitId ? ['v_budget_by_brand', unitId, year] : null,
    () => fetchViewBudgetByBrand(unitId!, year),
    { revalidateOnFocus: false }
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
    { revalidateOnFocus: false }
  );
}

// Invalidate all budget-related caches after a write
export function invalidateBudgetCaches(unitId: string, showroomId: string, year: number, month: number) {
  swrMutate(['v_budget_by_showroom', unitId, year]);
  swrMutate(['v_kpi_by_showroom_monthly', unitId, year]);
  swrMutate(['v_budget_by_channel', unitId, year]);
  swrMutate(['v_budget_by_brand', unitId, year]);
  swrMutate(['budget_entries', showroomId, year, month]);
}
