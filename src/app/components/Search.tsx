'use client';
import type { WineSearchResult } from '@/actions/wine-search';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { initialTastingForm, tastingAtom } from '../store/tasting';
import { WineSearch } from './WineSearch';

export const Search: React.FC = () => {
  const setTasting = useSetAtom(tastingAtom);
  const router = useRouter();

  const handleSelect = (wine: WineSearchResult) => {
    setTasting(initialTastingForm);
    router.push(`/smaking/${wine.id}`);
  };

  return (
    <WineSearch
      onSelect={handleSelect}
      placeholder="Sok etter vin (navn eller ID)..."
    />
  );
};
