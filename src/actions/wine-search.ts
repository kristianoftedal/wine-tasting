// Not a 'use server' action module: that restricts a file to async function
// exports only, and this one also exports WineSearchError. `server-only` gives
// the same guarantee that it can never be bundled into a client component --
// the build fails if one imports it as a value. The client reaches this code
// through the GET route at src/app/api/wine-search/route.ts.
import 'server-only';

import { WINE_SEARCH_LIMIT } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { foldSearchQuery, isValidSearchQuery, sanitizeSearchQuery } from '@/lib/validation';

export type WineSearchResult = {
  id: string;
  product_id: string;
  name: string;
  year: string | null;
  volume: number | null;
  main_category: string | null;
  main_country: string | null;
  district: string | null;
  price: number | null;
  similarity: number;
};

export class WineSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WineSearchError';
  }
}

/**
 * Type-ahead wine search.
 *
 * Deliberately has no fallback path. The previous version caught RPC errors and
 * retried with `ilike('name', '%query%')`, which looked like resilience but was
 * the opposite: search_wines_fuzzy was failing on nearly every query (a
 * NUMERIC cast on volumes stored as "37,5 cl"), and the fallback quietly
 * absorbed it. Because the fallback matched raw, unfolded names it could not
 * match "andre clouet" against "André Clouet", so the visible symptom was
 * "search sometimes returns nothing" rather than "the search function is
 * broken". Failures now propagate.
 */
export async function searchWines(query: string, limit = WINE_SEARCH_LIMIT): Promise<WineSearchResult[]> {
  if (!isValidSearchQuery(query)) {
    return [];
  }

  const supabase = await createClient();
  if (!supabase) {
    throw new WineSearchError('Supabase is not configured');
  }

  // Fold client-side too, so the query string matches the folded search
  // columns byte for byte and the cache key is stable across accent spellings.
  const searchTerm = foldSearchQuery(sanitizeSearchQuery(query));

  const { data, error } = await supabase.rpc('search_wines_fuzzy', {
    search_query: searchTerm,
    result_limit: limit
  });

  if (error) {
    console.error('[wine-search] search_wines_fuzzy failed', { query: searchTerm, error });
    throw new WineSearchError(error.message);
  }

  return data ?? [];
}
