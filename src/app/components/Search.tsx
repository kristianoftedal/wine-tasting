'use client';
import type { WineSearchResult } from '@/actions/wine-search';
import type { Wine } from '@/lib/types';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialTastingForm, tastingAtom } from '../store/tasting';
import { WineDetailsModal } from './WineDetailsModal';
import { WineSearch } from './WineSearch';

export const Search: React.FC = () => {
  const setTasting = useSetAtom(tastingAtom);
  const router = useRouter();

  const [wine, setWine] = useState<Wine | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Supersedes an in-flight lookup when the user picks another result. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Search results are trimmed rows, so picking one fetches the full record
   * before the sheet can render anything but a skeleton.
   */
  const handleSelect = useCallback(async (result: WineSearchResult) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setWine(null);
    setError(null);
    setIsLoading(true);
    setIsOpen(true);

    try {
      const res = await fetch(`/api/wine/${result.id}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: { wine?: Wine } = await res.json();
      if (controller.signal.aborted) return;
      if (!body.wine) throw new Error('missing wine');
      setWine(body.wine);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[search] wine lookup failed', err);
      setError('Kunne ikke hente vinen.');
      setIsOpen(false);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setIsOpen(false);
    setIsLoading(false);
    setWine(null);
  }, []);

  const handleStartTasting = useCallback(
    (selected: Wine) => {
      setTasting(initialTastingForm);
      setIsOpen(false);
      router.push(`/smaking/${selected.id}`);
    },
    [router, setTasting]
  );

  return (
    <>
      <WineSearch
        onSelect={handleSelect}
        placeholder="Sok etter vin (navn eller ID)..."
      />

      {error && (
        <p
          role="alert"
          style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}

      <WineDetailsModal
        wine={wine}
        isOpen={isOpen}
        isLoading={isLoading}
        onClose={handleClose}
        onStartTasting={handleStartTasting}
      />
    </>
  );
};
