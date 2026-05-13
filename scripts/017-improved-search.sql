-- =============================================================================
-- MIGRATION 017: Improved multi-field search
--
-- The current search_wines_fuzzy only matches on wine name via trigram.
-- This migration adds a pre-computed search_text column that concatenates
-- name, country, district, producer, category, grape varieties, food pairings,
-- and tasting traits — then rebuilds the search function to use word_similarity
-- against that column so queries like "Barossa" or "Pinot Noir" return results.
-- =============================================================================

-- 1. Replace generate_wine_search_text with a version that matches the actual
--    live schema. The original referenced description/summary/color/smell/taste
--    which don't exist on the imported wines table. Location/category fields are
--    handled defensively for both TEXT and JSONB storage.
CREATE OR REPLACE FUNCTION generate_wine_search_text(wine wines)
RETURNS TEXT AS $$
DECLARE
  search_parts  TEXT[];
  mc_name       TEXT;
  country_name  TEXT;
  producer_name TEXT;
  district_name TEXT;
  ingredient    JSONB;
  good_for      JSONB;
  trait         JSONB;
BEGIN
  mc_name := CASE
    WHEN (wine.main_category::text) LIKE '{%' THEN (wine.main_category::text)::jsonb->>'name'
    ELSE wine.main_category::text
  END;
  country_name := CASE
    WHEN (wine.main_country::text) LIKE '{%' THEN (wine.main_country::text)::jsonb->>'name'
    ELSE wine.main_country::text
  END;
  producer_name := CASE
    WHEN (wine.main_producer::text) LIKE '{%' THEN (wine.main_producer::text)::jsonb->>'name'
    ELSE wine.main_producer::text
  END;
  district_name := CASE
    WHEN (wine.district::text) LIKE '{%' THEN (wine.district::text)::jsonb->>'name'
    ELSE wine.district::text
  END;

  search_parts := ARRAY[
    wine.name,
    COALESCE(mc_name, ''),
    COALESCE(country_name, ''),
    COALESCE(producer_name, ''),
    COALESCE(district_name, '')
  ];

  IF wine.content IS NOT NULL AND wine.content->'ingredients' IS NOT NULL THEN
    FOR ingredient IN SELECT * FROM jsonb_array_elements(wine.content->'ingredients')
    LOOP
      search_parts := array_append(search_parts, COALESCE(ingredient->>'readableValue', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'isGoodFor' IS NOT NULL THEN
    FOR good_for IN SELECT * FROM jsonb_array_elements(wine.content->'isGoodFor')
    LOOP
      search_parts := array_append(search_parts, COALESCE(good_for->>'name', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'traits' IS NOT NULL THEN
    FOR trait IN SELECT * FROM jsonb_array_elements(wine.content->'traits')
    LOOP
      search_parts := array_append(search_parts, COALESCE(trait->>'readableValue', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'style'->>'description' IS NOT NULL THEN
    search_parts := array_append(search_parts, wine.content->'style'->>'description');
  END IF;

  RETURN array_to_string(search_parts, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Add search_text column
ALTER TABLE wines ADD COLUMN IF NOT EXISTS search_text TEXT;

-- 3. Populate for all existing wines
UPDATE wines SET search_text = generate_wine_search_text(wines.*);

-- 4. GIN trigram index on search_text — enables fast word_similarity queries
CREATE INDEX idx_wines_search_text_trgm ON wines USING GIN (search_text gin_trgm_ops);

-- 5. Trigger to keep search_text in sync on insert/update
CREATE OR REPLACE FUNCTION wines_update_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := generate_wine_search_text(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wines_search_text_sync
  BEFORE INSERT OR UPDATE OF name, main_category, main_country, main_producer,
    district, content
  ON wines
  FOR EACH ROW EXECUTE FUNCTION wines_update_search_text();

-- 6. Replace search_wines_fuzzy to search across all fields.
--    Uses word_similarity so a short query like "Italia" or "Chardonnay"
--    matches as a word within the longer search_text string.
--    Name matches are weighted higher than full-text matches.
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
