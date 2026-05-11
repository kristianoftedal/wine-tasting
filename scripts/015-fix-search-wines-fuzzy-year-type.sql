-- Fix search_wines_fuzzy: year column is TEXT, and volume/price/category/country/district
-- columns may be TEXT (not JSONB) in the live DB. Use ::text casts so this works
-- regardless of the actual column storage type.

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
      WHEN (w.volume::text) LIKE '{%' THEN ((w.volume::text)::jsonb->>'value')::numeric
      WHEN w.volume IS NOT NULL THEN split_part(w.volume::text, ' ', 1)::numeric
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
      WHEN w.price IS NOT NULL THEN replace(split_part(w.price::text, ' ', 2), ',', '.')::numeric
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
