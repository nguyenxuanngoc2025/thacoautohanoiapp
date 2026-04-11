'use client';

/**
 * BrandsContext — React Context cho dữ liệu Thương hiệu / Dòng xe
 *
 * ✅ Load 1 lần tại root layout
 * ✅ Cung cấp DEMO_BRANDS-equivalent cho toàn bộ app (planning, events, settings...)
 * ✅ Khi user cập nhật brands/models qua Settings, gọi refreshBrands() để reload
 */

import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
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
  refreshBrands: () => Promise<any>;
}

const BrandsContext = createContext<BrandsContextValue>({
  brands: STATIC_FALLBACK,
  isLoading: false,
  refreshBrands: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BrandsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  
  const { data: allBrands, error, isLoading, mutate } = useSWR<BrandWithModels[]>('master_brands', async () => {
    const data = await fetchBrandsWithModels();
    return data && data.length > 0 ? data : STATIC_FALLBACK;
  }, {
    fallbackData: STATIC_FALLBACK,
    revalidateOnFocus: false, // Dữ liệu danh mục xe hiếm khi đổi
    dedupingInterval: 60000,
  });

  // Filter theo user's allowed brands (chỉ áp dụng với mkt_brand có brands[])
  const brands: BrandWithModels[] = React.useMemo(() => {
    const brandsData = allBrands || STATIC_FALLBACK;
    if (
      profile?.role === 'mkt_brand' &&
      profile.brands &&
      profile.brands.length > 0
    ) {
      return brandsData.filter(b => profile.brands.includes(b.name));
    }
    return brandsData;
  }, [allBrands, profile?.role, profile?.brands]);

  return (
    <BrandsContext.Provider value={{ brands, isLoading, refreshBrands: async () => { mutate() } }}>
      {children}
    </BrandsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBrands() {
  return useContext(BrandsContext);
}
