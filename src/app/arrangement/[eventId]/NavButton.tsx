'use client';

import type React from 'react';

import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { initialTastingValue, tastingAtom } from '../../store/tasting';

export default function NavButton({
  eventId,
  code: productId,
  year,
  children
}: {
  eventId: string;
  code: string;
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
    router.push(`/smaking/${productId}?${params.toString()}`);
  };
  return (
    <button
      onClick={handleReset}
      aria-label={`smaking for ${eventId}`}>
      {children}
    </button>
  );
}
