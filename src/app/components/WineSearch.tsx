'use client';

import React from 'react';

import type { WineSearchResult } from '@/actions/wine-search';
import {
  WINE_SEARCH_CACHE_SIZE,
  WINE_SEARCH_DEBOUNCE_MS,
  WINE_SEARCH_LIMIT,
  WINE_SEARCH_MIN_QUERY_LENGTH
} from '@/lib/constants';
import { isValidSearchQuery, searchQueryKey } from '@/lib/validation';
import he from 'he';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './WineSearch.module.css';

type WineSearchProps = {
  onSelect: (wine: WineSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  limit?: number;
};

/**
 * Insertion-ordered cache of recent result sets, keyed by the folded query.
 *
 * Typing "andre clouet" and backspacing to "andre" re-asks for a prefix we
 * already have, and folding means "André" and "andre" share one entry.
 */
function createQueryCache(max: number) {
  const entries = new Map<string, WineSearchResult[]>();
  return {
    get(key: string) {
      const hit = entries.get(key);
      if (hit) {
        entries.delete(key); // refresh recency
        entries.set(key, hit);
      }
      return hit;
    },
    set(key: string, value: WineSearchResult[]) {
      if (entries.size >= max) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, value);
    }
  };
}

export function WineSearch({
  onSelect,
  placeholder = 'Søk etter vin...',
  autoFocus = false,
  disabled = false,
  limit = WINE_SEARCH_LIMIT
}: WineSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WineSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Monotonic request id. Responses can arrive out of order — a slow request
   * for "and" could otherwise land after a fast one for "andre clouet" and
   * overwrite the good results with stale ones.
   */
  const requestSeq = useRef(0);
  const cache = useMemo(() => createQueryCache(WINE_SEARCH_CACHE_SIZE), []);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      const key = searchQueryKey(searchQuery);

      const cached = cache.get(key);
      if (cached) {
        setResults(cached);
        setIsOpen(cached.length > 0);
        setError(null);
        setSelectedIndex(-1);
        setIsLoading(false);
        return;
      }

      abortRef.current?.abort(); // supersede whatever is in flight
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeq.current;

      setIsLoading(true);
      try {
        const res = await fetch(`/api/wine-search?q=${encodeURIComponent(searchQuery)}&limit=${limit}`, {
          signal: controller.signal
        });
        if (seq !== requestSeq.current) return; // a newer query already won

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: { results?: WineSearchResult[] } = await res.json();
        const found = body.results ?? [];

        cache.set(key, found);
        setResults(found);
        setIsOpen(found.length > 0);
        setError(null);
        setSelectedIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (seq !== requestSeq.current) return;
        setResults([]);
        setIsOpen(true); // show the error rather than an empty dropdown
        setError('Søket feilet. Prøv igjen.');
      } finally {
        if (seq === requestSeq.current) setIsLoading(false);
      }
    },
    [cache, limit]
  );

  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!isValidSearchQuery(searchQuery)) {
        abortRef.current?.abort();
        requestSeq.current++; // invalidate any response still on the wire
        setResults([]);
        setIsOpen(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      debounceRef.current = setTimeout(() => runSearch(searchQuery), WINE_SEARCH_DEBOUNCE_MS);
    },
    [runSearch]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  const handleSelect = (wine: WineSearchResult) => {
    onSelect(wine);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cancel pending timers and requests on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const tooShort = query.trim().length > 0 && !isValidSearchQuery(query);

  return (
    <div
      className={styles.container}
      ref={containerRef}>
      <div className={styles.inputWrapper}>
        <svg
          className={styles.searchIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <circle
            cx="11"
            cy="11"
            r="8"
          />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => (results.length > 0 || error) && setIsOpen(true)}
          placeholder={placeholder}
          className={styles.input}
          autoFocus={autoFocus}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className={styles.spinner}>
            <svg
              className={styles.spinnerIcon}
              viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                opacity="0.25"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      {tooShort && <p className={styles.hint}>Skriv minst {WINE_SEARCH_MIN_QUERY_LENGTH} tegn</p>}

      {isOpen && error && (
        <div
          className={styles.error}
          role="alert">
          {error}
        </div>
      )}

      {isOpen && !error && results.length > 0 && (
        <ul
          className={styles.dropdown}
          role="listbox">
          {results.map((wine, index) => (
            <li
              key={wine.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={`${styles.result} ${index === selectedIndex ? styles.resultSelected : ''}`}
              onClick={() => handleSelect(wine)}
              onMouseEnter={() => setSelectedIndex(index)}>
              <div className={styles.resultImage}>
                <Image
                  src={`/api/wine-image/${wine.product_id}`}
                  alt=""
                  width={40}
                  height={60}
                  className={styles.wineImage}
                  /**
                   * Every result image is a server-side proxy fetch to
                   * vinmonopolet. Eagerly loading all 20 made the dropdown feel
                   * slow even when the query itself was fast; only the rows
                   * actually scrolled into view are worth fetching.
                   */
                  loading="lazy"
                  unoptimized
                />
              </div>
              <div className={styles.resultInfo}>
                <span className={styles.resultName}>{he.decode(wine.name)}</span>
                <div className={styles.resultMeta}>
                  {wine.product_id && <span className={styles.metaTag}>#{wine.product_id}</span>}
                  {wine.main_country && <span className={styles.metaTag}>{wine.main_country}</span>}
                  {wine.district && <span className={styles.metaTag}>{wine.district}</span>}
                  {wine.year && <span className={styles.metaTag}>{wine.year}</span>}
                  {wine.volume && <span className={styles.metaTag}>{wine.volume} cl</span>}
                  {wine.price && <span className={styles.metaTag}>Kr {wine.price}</span>}
                  {wine.main_category && (
                    <span className={`${styles.metaTag} ${styles.categoryTag}`}>{wine.main_category}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
