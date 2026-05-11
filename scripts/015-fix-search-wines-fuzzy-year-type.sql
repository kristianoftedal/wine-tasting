-- Fix search_wines_fuzzy: year column is TEXT in the wines table but the
-- function return type declared it INTEGER. Drop and recreate with correct types.
--
-- Also uses CASE to handle main_category/main_country/district which may be
-- either JSONB objects ({ name: ... }) or plain TEXT depending on import path.

DROP FUNCTION IF EXISTS search_wines_fuzzy(text, integer);

CREATE OR REPLACE FUNCTION search_wines_fuzzy(search_query text, result_limit integer)
RETURNS TABLE (
  id          uuid,
  product_id  text,
  name        text,
  year        text,
  volume      numeric,
  main_category text,
  main_country  text,
  district      text,
  price         numeric,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    w.id,
    w.product_id,
    w.name,
    w.year,
    CASE
      WHEN jsonb_typeof(w.volume) IS NOT NULL THEN (w.volume->>'value')::numeric
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(w.main_category) IS NOT NULL THEN w.main_category->>'name'
      ELSE w.main_category::text
    END,
    CASE
      WHEN jsonb_typeof(w.main_country) IS NOT NULL THEN w.main_country->>'name'
      ELSE w.main_country::text
    END,
    CASE
      WHEN jsonb_typeof(w.district) IS NOT NULL THEN w.district->>'name'
      ELSE w.district::text
    END,
    CASE
      WHEN jsonb_typeof(w.price) IS NOT NULL THEN (w.price->>'value')::numeric
      ELSE NULL
    END,
    similarity(w.name, search_query)::float
  FROM wines w
  WHERE
    w.name % search_query
    OR w.name ILIKE '%' || search_query || '%'
  ORDER BY similarity(w.name, search_query) DESC
  LIMIT result_limit;
$$;
