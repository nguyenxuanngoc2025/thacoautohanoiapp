'use client';

/**
 * ShowroomsContext — React Context cho dữ liệu Showroom từ Database
 *
 * ✅ Load 1 lần tại root layout (giống BrandsContext)
 * ✅ Thay thế hoàn toàn MASTER_SHOWROOMS hard-coded
 * ✅ Cung cấp showrooms[] với weight, unit_id cho toàn bộ app
 * ✅ TỰ ĐỘNG LỌC theo activeUnitId từ UnitContext (Multi-Tenant)
 * ✅ Khi user cập nhật showroom qua Settings, gọi refreshShowrooms()
 */

import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { MASTER_SHOWROOMS } from '@/lib/master-data';
import { useUnit } from '@/contexts/UnitContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShowroomItem {
  id: string;
  code: string;
  name: string;
  weight: number;
  unit_id: string;
  is_active: boolean;
  brands: string[];
}

// ─── Fallback tĩnh khi DB chưa load ──────────────────────────────────────────

const STATIC_FALLBACK: ShowroomItem[] = MASTER_SHOWROOMS.map((s, i) => ({
  id: `fallback-${i}`,
  code: s.code,
  name: s.name,
  weight: s.weight,
  unit_id: '',
  is_active: true,
  brands: [],
}));

// ─── Context type ─────────────────────────────────────────────────────────────

interface ShowroomsContextValue {
  /** Tất cả showrooms active (không lọc Unit — dùng cho Settings/Admin) */
  allShowrooms: ShowroomItem[];
  /** Showrooms đã lọc theo activeUnitId (dùng cho Planning/Actual/Reports) */
  showrooms: ShowroomItem[];
  /** Map tên showroom → weight (tiện cho các trang nghiệp vụ) */
  weightMap: Record<string, number>;
  /** Danh sách tên showroom (thay thế DEMO_SHOWROOMS) */
  showroomNames: string[];
  isLoading: boolean;
  refreshShowrooms: () => Promise<any>;
}

const ShowroomsContext = createContext<ShowroomsContextValue>({
  allShowrooms: STATIC_FALLBACK,
  showrooms: STATIC_FALLBACK,
  weightMap: Object.fromEntries(MASTER_SHOWROOMS.map(s => [s.name, s.weight])),
  showroomNames: MASTER_SHOWROOMS.map(s => s.name),
  isLoading: false,
  refreshShowrooms: async () => {},
});

// ─── Fetcher ──────────────────────────────────────────────────────────────────
const fetchShowrooms = async (): Promise<ShowroomItem[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_showrooms')
    .select('id, code, name, weight, unit_id, is_active, brands')
    .eq('is_active', true)
    .order('weight', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    weight: Number(row.weight) || 0,
    brands: row.brands || [],
  }));
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ShowroomsProvider({ children }: { children: React.ReactNode }) {
  const { activeUnitId } = useUnit();

  const { data: allShowroomsRaw, error, isLoading, mutate } = useSWR<ShowroomItem[]>(
    'master_showrooms',
    fetchShowrooms,
    {
      fallbackData: STATIC_FALLBACK,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      // Retry on error (e.g. 401 khi auth chưa sẵn sàng) — tối đa 8 lần, mỗi lần cách 2s
      shouldRetryOnError: true,
      errorRetryCount: 8,
      errorRetryInterval: 2000,
    }
  );

  const allShowrooms = allShowroomsRaw || STATIC_FALLBACK;

  // ─── CASCADE FILTER: Lọc showrooms theo Unit đang active ───────────────────
  const showrooms = useMemo(() => {
    if (activeUnitId === 'all') return allShowrooms;
    const filtered = allShowrooms.filter(s => s.unit_id === activeUnitId);
    
    // Nếu filter ra rỗng VÀ đang dùng STATIC_FALLBACK (chưa load xong báo cáo từ SWR),
    // Thì trả về nguyên mảng allShowrooms để tránh trang thái rỗng tạm thời gây wipe data.
    if (filtered.length === 0 && allShowrooms === STATIC_FALLBACK) {
      return allShowrooms;
    }
    return filtered;
  }, [allShowrooms, activeUnitId]);

  // Derived values — tính từ showrooms đã lọc
  const weightMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    showrooms.forEach(s => { map[s.name] = s.weight; });
    return map;
  }, [showrooms]);

  const showroomNames = React.useMemo(() => showrooms.map(s => s.name), [showrooms]);

  return (
    <ShowroomsContext.Provider value={{
      allShowrooms,
      showrooms,
      weightMap,
      showroomNames,
      isLoading,
      refreshShowrooms: async () => { mutate(); },
    }}>
      {children}
    </ShowroomsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShowrooms() {
  return useContext(ShowroomsContext);
}
