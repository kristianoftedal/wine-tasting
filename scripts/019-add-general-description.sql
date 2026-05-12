-- =============================================================================
-- MIGRATION 019: Extract general_description from content, drop content column
--
-- wines.content was a large JSONB blob. The useful sub-fields are now stored in
-- dedicated columns:
--   content->'isGoodFor'              → is_good_for  (already exists)
--   content->>'Description'→Style→Description → general_description (added here)
--
-- After populating general_description this migration updates all functions and
-- triggers that referenced content, then drops the column.
-- =============================================================================

-- 1. Add dedicated columns
ALTER TABLE wines ADD COLUMN IF NOT EXISTS general_description TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS grapes TEXT[];

-- 2. Populate general_description from content and strip the Description key
UPDATE wines
SET
  general_description = (content->>'Description')::jsonb->'Style'->>'Description',
  content             = content - 'Description'
WHERE content ? 'Description';

-- 3. Update generate_wine_search_text to use dedicated columns instead of content
CREATE OR REPLACE FUNCTION generate_wine_search_text(wine wines)
RETURNS TEXT AS $$
DECLARE
  search_parts  TEXT[];
  mc_name       TEXT;
  country_name  TEXT;
  producer_name TEXT;
  district_name TEXT;
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
    COALESCE(district_name, ''),
    COALESCE(wine.general_description, '')
  ];

  IF wine.grapes IS NOT NULL THEN
    search_parts := search_parts || wine.grapes;
  END IF;

  IF wine.is_good_for IS NOT NULL THEN
    search_parts := search_parts || wine.is_good_for;
  END IF;

  RETURN array_to_string(search_parts, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Update the search_text sync trigger — remove content from the UPDATE OF list
DROP TRIGGER IF EXISTS wines_search_text_sync ON wines;

CREATE TRIGGER wines_search_text_sync
  BEFORE INSERT OR UPDATE OF name,
    main_category, main_country, main_producer, general_description, grapes, is_good_for
  ON wines
  FOR EACH ROW EXECUTE FUNCTION wines_update_search_text();

-- 5. Drop match_wines — it referenced content and embedding (not on live table).
--    Recreate when embedding column is available.
DROP FUNCTION IF EXISTS match_wines(vector, float, int);

-- 6. Update search_wines_by_food to use the is_good_for column
DROP FUNCTION IF EXISTS search_wines_by_food(text, integer);

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
    food_name AS food_match
  FROM wines w,
    unnest(w.is_good_for) AS food_name
  WHERE
    w.is_good_for IS NOT NULL
    AND food_name ILIKE '%' || food_query || '%'
  ORDER BY w.id, w.name
  LIMIT result_limit;
$$;

-- 7. Drop the GIN index that depended on content->'isGoodFor'
DROP INDEX IF EXISTS idx_wines_isgoodfor;

-- 8. Add equivalent GIN index on the is_good_for column
CREATE INDEX IF NOT EXISTS idx_wines_is_good_for ON wines USING GIN (is_good_for);

-- 9. Drop triggers that depend on content before dropping the column
DROP TRIGGER IF EXISTS wines_general_description_sync ON wines;

-- 10. Drop the content column
ALTER TABLE wines DROP COLUMN IF EXISTS content;
