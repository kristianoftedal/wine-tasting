import { WINE_SEARCH_MIN_QUERY_LENGTH } from './constants';

/**
 * Diacritic and Norwegian character folding.
 *
 * Must stay in lockstep with the wine_fold() SQL function in
 * scripts/021-search-overhaul.sql — the database stores folded search columns,
 * so a query folded differently here simply will not match. This is why
 * "andre clouet" used to return nothing for "André Clouet".
 */
export function foldSearchQuery(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/ø/gi, 'o')
    .replace(/å/gi, 'a')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Sanitize search query to prevent injection attacks and cap the work the
 * database can be asked to do for one keystroke.
 */
export function sanitizeSearchQuery(query: string): string {
  return query.trim().slice(0, 200);
}

/**
 * Normalized cache/request key for a query. Two inputs that fold to the same
 * string will produce identical results, so they should share a cache entry.
 */
export function searchQueryKey(query: string): string {
  return foldSearchQuery(sanitizeSearchQuery(query));
}

/**
 * Validate wine search query. See WINE_SEARCH_MIN_QUERY_LENGTH for why the
 * floor is three characters.
 */
export function isValidSearchQuery(query: string): boolean {
  return foldSearchQuery(sanitizeSearchQuery(query)).replace(/\s/g, '').length >= WINE_SEARCH_MIN_QUERY_LENGTH;
}
