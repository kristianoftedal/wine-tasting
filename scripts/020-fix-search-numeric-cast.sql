-- =============================================================================
-- MIGRATION 020: Fix invalid numeric cast in search_wines_fuzzy
--
-- split_part returns '' when the delimiter is not found (e.g. price stored as
-- "199.00" with no space, or volume stored as an empty string). Casting '' to
-- NUMERIC raises: invalid input syntax for type numeric: ""
-- Fix: wrap both split_part results in NULLIF(..., '') so missing parts become
-- NULL rather than crashing.
-- =============================================================================

DROP FUNCTION IF EXISTS search_wines_fuzzy(text, integer);

CREATE OR REPLACE FUNCTION search_wines_fuzzy(
  search_query  TEXT,
  result_limit  INTEGER
)
RETURNS TABLE (
  id            UUID,
  product_id    TEXT,
  name          TEXT,
  year          TEXT,
  volume        NUMERIC,
  main_category TEXT,
  main_country  TEXT,
  district      TEXT,
  price         NUMERIC,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    w.id,
    w.product_id,
    w.name,
    w.year,
    CASE
      WHEN (w.volume::text) LIKE '{%' THEN ((w.volume::text)::jsonb->>'value')::numeric
      WHEN w.volume IS NOT NULL        THEN NULLIF(split_part(w.volume::text, ' ', 1), '')::numeric
      ELSE NULL
    END,
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
      WHEN w.price IS NOT NULL         THEN NULLIF(replace(split_part(w.price::text, ' ', 2), ',', '.'), '')::numeric
      ELSE NULL
    END,
    GREATEST(
      similarity(w.name, search_query),
      word_similarity(search_query, w.search_text) * 0.7
    )::float AS similarity
  FROM wines w
  WHERE
    w.name % search_query
    OR search_query <% w.search_text
    OR w.name ILIKE '%' || search_query || '%'
  ORDER BY GREATEST(
    similarity(w.name, search_query),
    word_similarity(search_query, w.search_text) * 0.7
  ) DESC
  LIMIT result_limit;
$$;
