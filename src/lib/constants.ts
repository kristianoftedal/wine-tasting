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

/**
 * Debounce before firing a search. Zero means every keystroke queries.
 *
 * This was 200ms, which is a flat 200ms added to every single search — a third
 * of the total time a user waited. That tax made sense when the query itself
 * cost 70-500ms and each request was an uncancellable POST server action. It no
 * longer does: the query is ~5ms server-side, superseded requests are aborted
 * rather than left to complete, and repeated prefixes are served from the
 * client cache without touching the network at all.
 *
 * The cost is more requests while typing — up to one per keystroke instead of
 * one per pause. They are GETs with cache headers, they abort as soon as the
 * next keystroke lands, and the 3-character floor keeps the shortest and
 * broadest ones from ever being sent. Set this back to 150-200 if request
 * volume against Supabase becomes a concern.
 */
export const WINE_SEARCH_DEBOUNCE_MS = 0;

/** How many recent queries to keep client-side, so backspacing is free. */
export const WINE_SEARCH_CACHE_SIZE = 50;
