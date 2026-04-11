'use client';

/**
 * ShowroomsContext — React Context cho dữ liệu Showroom từ Database
 *
 * ✅ Load 1 lần tại root layout (giống BrandsContext)
 * ✅ Thay thế hoàn toàn MASTER_SHOWROOMS hard-coded
 * ✅ Cung cấp showrooms[] với weight, unit_id cho toàn bộ app
 * ✅ Khi user cập nhật showroom qua Settings, gọi refreshShowrooms()
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MASTER_SHOWROOMS } from '@/lib/master-data';

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
  /** Danh sách showrooms active từ DB (có weight, unit_id) */
  showrooms: ShowroomItem[];
  /** Map tên showroom → weight (tiện cho các trang nghiệp vụ) */
  weightMap: Record<string, number>;
  /** Danh sách tên showroom (thay thế DEMO_SHOWROOMS) */
  showroomNames: string[];
  isLoading: boolean;
  refreshShowrooms: () => Promise<void>;
}

const ShowroomsContext = createContext<ShowroomsContextValue>({
  showrooms: STATIC_FALLBACK,
  weightMap: Object.fromEntries(MASTER_SHOWROOMS.map(s => [s.name, s.weight])),
  showroomNames: MASTER_SHOWROOMS.map(s => s.name),
  isLoading: false,
  refreshShowrooms: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ShowroomsProvider({ children }: { children: React.ReactNode }) {
  const [showrooms, setShowrooms] = useState<ShowroomItem[]>(STATIC_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const refreshShowrooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('thaco_showrooms')
        .select('id, code, name, weight, unit_id, is_active, brands')
        .eq('is_active', true)
        .order('weight', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setShowrooms(data.map(row => ({
          ...row,
          weight: Number(row.weight) || 0,
          brands: row.brands || [],
        })));
      }
    } catch (e) {
      console.warn('[ShowroomsContext] Error loading showrooms, keeping fallback:', e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Load lần đầu
  useEffect(() => {
    refreshShowrooms();
  }, [refreshShowrooms]);

  // Derived values
  const weightMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    showrooms.forEach(s => { map[s.name] = s.weight; });
    return map;
  }, [showrooms]);

  const showroomNames = React.useMemo(() => showrooms.map(s => s.name), [showrooms]);

  return (
    <ShowroomsContext.Provider value={{ showrooms, weightMap, showroomNames, isLoading, refreshShowrooms }}>
      {children}
    </ShowroomsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShowrooms() {
  return useContext(ShowroomsContext);
}
