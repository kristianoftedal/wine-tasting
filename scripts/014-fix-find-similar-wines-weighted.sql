-- Replace find_similar_wines_weighted with a candidate-only filter.
--
-- Fixes three issues in the previous definition:
--   1. Four parameters (p_smell_similarity, p_taste_similarity,
--      p_alcohol_similarity, p_price_similarity) were accepted but never
--      referenced in the body — dead signature surface.
--   2. `WHERE w.main_category = p_main_category` returned zero rows when
--      the caller passed NULL to mean "no category filter", because
--      `anything = NULL` evaluates to NULL in SQL.
--   3. `AND w.fylde IS NOT NULL` silently excluded wines with sparse
--      metadata. The JS scorer handles null attributes fine, so let
--      them through.
--
-- Also drops the returned `similarity_score` column: JS computes the
-- final ranking with semantic embeddings + per-component weighted
-- averaging, and never read this column (it was aliased on the JS side
-- as `numeric_score`, which didn't exist, so it was always 0). Removing
-- it makes the contract honest.
--
-- Uses RETURNS SETOF wines so the function automatically tracks the
-- actual `wines` table schema — avoids drift between this migration and
-- whatever columns the live table has (some columns in migration 009
-- were declared JSONB but are now TEXT in production).
--
-- The rows are still ordered by aggregate attribute distance so the
-- JS-side `slice(0, limit * 2)` picks up the best candidates first.

DROP FUNCTION IF EXISTS find_similar_wines_weighted(
  NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  UUID[], TEXT, INT
);

DROP FUNCTION IF EXISTS find_similar_wines_weighted(
  NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  UUID[], TEXT, INT
);

CREATE OR REPLACE FUNCTION find_similar_wines_weighted(
  p_fylde NUMERIC,
  p_friskhet NUMERIC,
  p_garvestoff NUMERIC,
  p_sodme NUMERIC,
  p_excluded_wine_ids UUID[],
  p_main_category TEXT,
  p_limit INT
)
RETURNS SETOF wines
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT w.*
  FROM wines w
  WHERE
    (p_main_category IS NULL OR w.main_category = p_main_category)
    AND (p_excluded_wine_ids IS NULL OR NOT (w.id = ANY(p_excluded_wine_ids)))
  ORDER BY
    (
      COALESCE(1.0 - ABS(w.fylde - p_fylde) / 12.0, 0) +
      COALESCE(1.0 - ABS(w.friskhet - p_friskhet) / 12.0, 0) +
      COALESCE(1.0 - ABS(w.garvestoff - p_garvestoff) / 12.0, 0) +
      COALESCE(1.0 - ABS(w.sodme - p_sodme) / 12.0, 0)
    ) DESC
  LIMIT p_limit;
END;
$$;
