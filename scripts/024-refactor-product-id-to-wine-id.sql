-- Migration: Replace product_id (TEXT) with wine_id (UUID) foreign key
-- This ensures tastings and events properly reference unique wines by their UUID id
-- instead of product_id which is not unique across vintages

-- Step 1: Add wine_id column to tastings table
ALTER TABLE tastings ADD COLUMN wine_id UUID;

-- Step 2: Populate wine_id from product_id
-- This matches the product_id in tastings to wines.product_id and copies the wine's UUID id
UPDATE tastings t
SET wine_id = w.id
FROM wines w
WHERE t.product_id = w.product_id;

-- Step 3: Add foreign key constraint
ALTER TABLE tastings 
ADD CONSTRAINT tastings_wine_id_fkey 
FOREIGN KEY (wine_id) REFERENCES wines(id) ON DELETE CASCADE;

-- Step 4: Create index for wine_id
CREATE INDEX idx_tastings_wine_id ON tastings(wine_id);

-- Step 5: Drop old product_id column and its index
DROP INDEX IF EXISTS idx_tastings_product_id;
ALTER TABLE tastings DROP COLUMN product_id;

-- Step 6: Rename wine_id to id for clarity (optional, but makes it clearer)
-- Actually, let's keep it as wine_id to be explicit about the relationship

-- Step 7: Update the find_similar_wines_weighted function to use wine_id
DROP FUNCTION IF EXISTS find_similar_wines_weighted(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, 
  text[], text, integer
);

CREATE OR REPLACE FUNCTION find_similar_wines_weighted(
  p_fylde numeric,
  p_friskhet numeric,
  p_garvestoff numeric,
  p_sodme numeric,
  p_smell_similarity numeric,
  p_taste_similarity numeric,
  p_alcohol_similarity numeric,
  p_price_similarity numeric,
  p_excluded_wine_ids uuid[], -- Changed from text[] to uuid[]
  p_main_category text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid, -- Added wine UUID id
  product_id TEXT,
  name TEXT,
  year INTEGER,
  price NUMERIC,
  main_category TEXT,
  main_country TEXT,
  smell TEXT,
  taste TEXT,
  fylde NUMERIC,
  friskhet NUMERIC,
  garvestoff NUMERIC,
  sodme NUMERIC,
  content JSONB,
  numeric_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id, -- Return wine UUID id
    w.product_id,
    w.name,
    CAST(w.year AS INTEGER),
    CAST(w.price AS NUMERIC),
    w.main_category,
    w.main_country,
    w.smell,
    w.taste,
    w.fylde,
    w.friskhet,
    w.garvestoff,
    w.sodme,
    w.content,
    (
      -- Category-specific weighted scoring
      CASE 
        WHEN w.main_category = 'Rødvin' THEN
          (
            COALESCE(1.0 - ABS(w.fylde - p_fylde) / 12.0, 0) * 1.0 +
            COALESCE(1.0 - ABS(w.friskhet - p_friskhet) / 12.0, 0) * 1.0 +
            COALESCE(1.0 - ABS(w.garvestoff - p_garvestoff) / 12.0, 0) * 1.0 +
            COALESCE(p_smell_similarity, 0) * 1.0 +
            COALESCE(p_taste_similarity, 0) * 1.0 +
            COALESCE(p_alcohol_similarity, 0) * 0.2 +
            COALESCE(p_price_similarity, 0) * 0.2
          ) / 5.4
        ELSE
          (
            COALESCE(1.0 - ABS(w.fylde - p_fylde) / 12.0, 0) * 1.0 +
            COALESCE(1.0 - ABS(w.friskhet - p_friskhet) / 12.0, 0) * 1.0 +
            COALESCE(1.0 - ABS(w.sodme - p_sodme) / 12.0, 0) * 1.0 +
            COALESCE(p_smell_similarity, 0) * 1.0 +
            COALESCE(p_taste_similarity, 0) * 1.0 +
            COALESCE(p_alcohol_similarity, 0) * 0.2 +
            COALESCE(p_price_similarity, 0) * 0.2
          ) / 5.4
      END
    ) AS numeric_score
  FROM wines w
  WHERE NOT (w.id = ANY(p_excluded_wine_ids)) -- Compare UUID ids
    AND (p_main_category IS NULL OR w.main_category = p_main_category)
    AND (
      (w.main_category = 'Rødvin' AND w.fylde IS NOT NULL AND w.friskhet IS NOT NULL AND w.garvestoff IS NOT NULL)
      OR
      (w.main_category IN ('Hvitvin', 'Musserende vin') AND w.fylde IS NOT NULL AND w.friskhet IS NOT NULL AND w.sodme IS NOT NULL)
    )
  ORDER BY numeric_score DESC
  LIMIT p_limit;
END;
$$;

-- Step 8: Update events table to use wine UUIDs instead of product_id strings
-- Add new column for wine_ids (UUID array)
ALTER TABLE events ADD COLUMN wine_ids UUID[] DEFAULT '{}';

-- Migrate existing wine product_ids to wine_ids
-- This is more complex as we need to match each product_id string to a wine UUID
UPDATE events e
SET wine_ids = (
  SELECT ARRAY_AGG(w.id)
  FROM wines w
  WHERE w.product_id = ANY(e.wines)
)
WHERE e.wines IS NOT NULL AND array_length(e.wines, 1) > 0;

-- Drop old wines column
ALTER TABLE events DROP COLUMN wines;

-- Rename wine_ids to wines for backward compatibility
ALTER TABLE events RENAME COLUMN wine_ids TO wines;

COMMENT ON COLUMN tastings.wine_id IS 'Foreign key to wines.id (UUID) - uniquely identifies a specific wine vintage';
COMMENT ON COLUMN events.wines IS 'Array of wine UUIDs for the event';
