'use client';

/**
 * BrandsContext — React Context cho dữ liệu Thương hiệu / Dòng xe
 *
 * ✅ Load 1 lần tại root layout
 * ✅ Cung cấp DEMO_BRANDS-equivalent cho toàn bộ app (planning, events, settings...)
 * ✅ Khi user cập nhật brands/models qua Settings, gọi refreshBrands() để reload
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchBrandsWithModels, type BrandWithModels } from '@/lib/brands-data';
import { MASTER_BRANDS } from '@/lib/master-data';
import { useAuth } from '@/contexts/AuthContext';

// ─── Fallback tĩnh khi DB chưa load ──────────────────────────────────────────

const STATIC_FALLBACK: BrandWithModels[] = MASTER_BRANDS.map(b => ({
  name: b.name,
  color: null,
  models: b.models,
  modelData: b.models.map(m => ({ name: m, is_aggregate: false, aggregate_group: null })),
}));

// ─── Context type ─────────────────────────────────────────────────────────────

interface BrandsContextValue {
  brands: BrandWithModels[];       // Danh sách brands+models đang active từ DB
  isLoading: boolean;
  refreshBrands: () => Promise<void>;
}

const BrandsContext = createContext<BrandsContextValue>({
  brands: STATIC_FALLBACK,
  isLoading: false,
  refreshBrands: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BrandsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [allBrands, setAllBrands] = useState<BrandWithModels[]>(STATIC_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchBrandsWithModels();
      if (data && data.length > 0) setAllBrands(data);
    } catch (e) {
      console.warn('[BrandsContext] Error loading brands, keeping fallback:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load lần đầu
  useEffect(() => {
    refreshBrands();
  }, [refreshBrands]);

  // Filter theo user's allowed brands (chỉ áp dụng với mkt_brand có brands[])
  const brands: BrandWithModels[] = React.useMemo(() => {
    if (
      profile?.role === 'mkt_brand' &&
      profile.brands &&
      profile.brands.length > 0
    ) {
      return allBrands.filter(b => profile.brands.includes(b.name));
    }
    return allBrands;
  }, [allBrands, profile?.role, profile?.brands]);

  return (
    <BrandsContext.Provider value={{ brands, isLoading, refreshBrands }}>
      {children}
    </BrandsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrands() {
  return useContext(BrandsContext);
}
