'use client';

import React from 'react';
import { BrandsProvider } from '@/contexts/BrandsContext';
import { ShowroomsProvider } from '@/contexts/ShowroomsContext';
import { UnitProvider } from '@/contexts/UnitContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    // UnitProvider bọc ngoài cùng vì ShowroomsProvider sẽ đọc activeUnitId từ UnitContext
    <UnitProvider>
      <BrandsProvider>
        <ShowroomsProvider>
          {children}
        </ShowroomsProvider>
      </BrandsProvider>
    </UnitProvider>
  );
}
