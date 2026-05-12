-- =============================================================================
-- MIGRATION 018: Food pairing search + wine article enrichment
--
-- Part 1 — Wine-side food pairing
--   Uses the dedicated is_good_for column (JSONB array of {name, ...} objects)
--   on the wines table. Adds a GIN index and a search_wines_by_food function.
--
-- Part 2 — Wine article enrichment
--   Adds food_tags and occasion_tags columns to wine_articles so scraped
--   Vinmonopolet pairing articles can be filtered by food category alongside
--   semantic embedding search.
-- =============================================================================


-- ─── PART 1: Food pairing search on wines ────────────────────────────────────

-- GIN index on is_good_for — enables fast containment (@>) queries
CREATE INDEX IF NOT EXISTS idx_wines_isgoodfor
  ON wines USING GIN (is_good_for);

-- Returns wines whose is_good_for list contains a food matching the query.
-- Exact containment is fast via the GIN index; ILIKE fallback catches partial
-- matches (e.g. "pasta" matches "Pizza og pasta").
CREATE OR REPLACE FUNCTION search_wines_by_food(
  food_query   TEXT,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id            UUID,
  product_id    TEXT,
  name          TEXT,
  year          TEXT,
  main_category TEXT,
  main_country  TEXT,
  district      TEXT,
  price         NUMERIC,
  food_match    TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT DISTINCT ON (w.id)
    w.id,
    w.product_id,
    w.name,
    w.year,
    CASE
      WHEN (w.main_category::text) LIKE '{%' THEN (w.main_category::text)::jsonb->>'name'
      ELSE w.main_category::text
    END,
    CASE
      WHEN (w.main_country::text) LIKE '{%' THEN (w.main_country::text)::jsonb->>'name'
      ELSE w.main_country::text
    END,
    CASE
      WHEN (w.district::text) LIKE '{%' THEN (w.district::text)::jsonb->>'name'
      ELSE w.district::text
    END,
    CASE
      WHEN (w.price::text) LIKE '{%' THEN ((w.price::text)::jsonb->>'value')::numeric
      WHEN w.price IS NOT NULL THEN replace(split_part(w.price::text, ' ', 2), ',', '.')::numeric
      ELSE NULL
    END,
    elem->>'name' AS food_match
  FROM wines w,
    jsonb_array_elements(w.is_good_for) AS elem
  WHERE
    w.is_good_for IS NOT NULL
    AND jsonb_array_length(w.is_good_for) > 0
    AND elem->>'name' ILIKE '%' || food_query || '%'
  ORDER BY w.id, w.name
  LIMIT result_limit;
$$;


-- ─── PART 2: Wine article enrichment ─────────────────────────────────────────

ALTER TABLE wine_articles ADD COLUMN IF NOT EXISTS food_tags     TEXT[] DEFAULT '{}';
ALTER TABLE wine_articles ADD COLUMN IF NOT EXISTS occasion_tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_wine_articles_food_tags
  ON wine_articles USING GIN (food_tags);
CREATE INDEX IF NOT EXISTS idx_wine_articles_occasion_tags
  ON wine_articles USING GIN (occasion_tags);
