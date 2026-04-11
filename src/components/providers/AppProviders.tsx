'use client';

import React from 'react';
import { BrandsProvider } from '@/contexts/BrandsContext';
import { ShowroomsProvider } from '@/contexts/ShowroomsContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrandsProvider>
      <ShowroomsProvider>
        {children}
      </ShowroomsProvider>
    </BrandsProvider>
  );
}
