'use client';

import type React from 'react';

import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { initialTastingValue, tastingAtom } from '../../store/tasting';

export default function NavButton({
  eventId,
  wineId,
  year,
  children
}: {
  eventId: string;
  wineId: string;
  year?: string;
  children: React.ReactNode;
}) {
  const setTasting = useSetAtom(tastingAtom);
  const router = useRouter();

  const handleReset = () => {
    setTasting(initialTastingValue);
    const params = new URLSearchParams();
    params.set('eventId', eventId);
    if (year) params.set('year', year);
    router.push(`/smaking/${wineId}?${params.toString()}`);
  };
  return (
    <button
      onClick={handleReset}
      aria-label={`smaking for ${eventId}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit'
      }}>
      {children}
    </button>
  );
}
