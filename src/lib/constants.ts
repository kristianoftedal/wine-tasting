export const WINE_SEARCH_LIMIT = 20;

/**
 * Minimum characters before we hit the database.
 *
 * Three is a hard floor, not a preference: pg_trgm builds three-character
 * trigrams, so a GIN trigram index cannot serve `LIKE '%ab%'` at all. A
 * two-character query degrades to a sequential scan over ~50k rows, which is
 * both slow and useless — "an" matches thousands of wines.
 *
 * Going higher would not narrow results either; that is a ranking problem,
 * solved by the tier ladder in search_wines_fuzzy (exact id > exact name >
 * prefix > word-start > tokens > fuzzy), not by making users type more. A
 * longer minimum would only break legitimately short searches like "Ruby
 * White" or a producer typed as "Bru".
 */
export const WINE_SEARCH_MIN_QUERY_LENGTH = 3;

/** Debounce before firing a search. One keystroke ≈ 120–200ms for most typists. */
export const WINE_SEARCH_DEBOUNCE_MS = 200;

/** How many recent queries to keep client-side, so backspacing is free. */
export const WINE_SEARCH_CACHE_SIZE = 50;

export const EMBEDDING_MAX_RETRIES = 3;
export const EMBEDDING_MAX_LENGTH = 8000;
