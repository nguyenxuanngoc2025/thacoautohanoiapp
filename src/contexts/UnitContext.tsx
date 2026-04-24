'use client';

/**
 * UnitContext — Multi-Tenant Unit Switcher Context
 *
 * ✅ Cho phép Super Admin chuyển đổi ngữ cảnh Công ty (Unit) toàn cục
 * ✅ Các role khác tự động bị khoá vào unit_id của mình
 * ✅ ShowroomsContext đọc activeUnitId để lọc dữ liệu theo Unit
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { type Unit } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveUnitId = string | 'all';

interface UnitContextValue {
  /** Unit đang được chọn, 'all' = toàn hệ thống (chỉ super_admin) */
  activeUnitId: ActiveUnitId;
  /** Object Unit đang active, null khi 'all' hoặc chưa load */
  activeUnit: Unit | null;
  /** Danh sách Units user có quyền xem */
  availableUnits: Unit[];
  /** Loading state */
  isLoading: boolean;
  /** Có thể chuyển Unit không (chỉ super_admin = true) */
  canSwitchUnits: boolean;
  /** Setter — chỉ có tác dụng khi canSwitchUnits = true */
  setActiveUnitId: (id: ActiveUnitId) => void;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetchAllUnits = async (): Promise<Unit[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('thaco_units')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data || []) as Unit[];
};

// ─── Context ──────────────────────────────────────────────────────────────────

const UnitContext = createContext<UnitContextValue>({
  activeUnitId: 'all',
  activeUnit: null,
  availableUnits: [],
  isLoading: false,
  canSwitchUnits: false,
  setActiveUnitId: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const { profile, isSuperAdmin, isLoading: authLoading } = useAuth();

  // Fetch toàn bộ units (chỉ dùng khi super_admin)
  const { data: allUnits = [], isLoading: unitsLoading } = useSWR<Unit[]>(
    isSuperAdmin ? 'all_units' : null, // Chỉ fetch khi super_admin
    fetchAllUnits,
    { revalidateOnFocus: false, dedupingInterval: 300000 } // Cache 5 phút
  );

  const canSwitchUnits = isSuperAdmin;

  // Đọc localStorage ngay khi khởi tạo để tránh double-fetch (all → unit)
  const [activeUnitId, setActiveUnitIdState] = useState<ActiveUnitId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thaco_active_unit_id');
      if (saved) return saved;
    }
    return 'all';
  });

  // Khi auth thay đổi (đăng nhập/đăng xuất), khôi phục từ localStorage hoặc reset về default
  useEffect(() => {
    if (!authLoading) {
      if (isSuperAdmin) {
        const saved = localStorage.getItem('thaco_active_unit_id');
        setActiveUnitIdState(saved || 'all');
      } else {
        // Non-super_admin: khoá vào unit_id, xóa saved nếu có
        localStorage.removeItem('thaco_active_unit_id');
        setActiveUnitIdState(profile?.unit_id ?? 'all');
      }
    }
  }, [isSuperAdmin, profile?.unit_id, authLoading]);

  // Khi allUnits load xong và chưa có saved preference → auto-select unit của profile
  useEffect(() => {
    if (isSuperAdmin && allUnits.length > 0) {
      const saved = localStorage.getItem('thaco_active_unit_id');
      if (!saved && activeUnitId === 'all') {
        // Ưu tiên unit của profile (unit_id), fallback unit đầu tiên
        const defaultUnit = profile?.unit_id
          ? allUnits.find(u => u.id === profile.unit_id) ?? allUnits[0]
          : allUnits[0];
        setActiveUnitIdState(defaultUnit.id);
      }
    }
  }, [isSuperAdmin, allUnits, activeUnitId, profile?.unit_id]);

  const setActiveUnitId = (id: ActiveUnitId) => {
    if (!canSwitchUnits) return; // Guard: chỉ super_admin được đổi
    setActiveUnitIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('thaco_active_unit_id', id);
    }
  };

  // Danh sách units khả dụng
  const availableUnits: Unit[] = useMemo(() => {
    if (isSuperAdmin) return allUnits;
    // Role khác chỉ thấy Unit của mình (nếu có)
    if (profile?.unit) return [profile.unit as Unit];
    return [];
  }, [isSuperAdmin, allUnits, profile?.unit]);

  // activeUnit object
  const activeUnit: Unit | null = useMemo(() => {
    if (activeUnitId === 'all') return null;
    return availableUnits.find(u => u.id === activeUnitId) ?? null;
  }, [activeUnitId, availableUnits]);

  const isLoading = authLoading || (isSuperAdmin && unitsLoading);

  return (
    <UnitContext.Provider value={{
      activeUnitId,
      activeUnit,
      availableUnits,
      isLoading,
      canSwitchUnits,
      setActiveUnitId,
    }}>
      {children}
    </UnitContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUnit() {
  return useContext(UnitContext);
}
