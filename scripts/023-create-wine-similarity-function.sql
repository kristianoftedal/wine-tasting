-- Create PostgreSQL function to calculate wine similarity using the new columns
-- This pushes the calculation into the database for better performance
-- Handles category-specific attributes: Rødvin has garvestoff, Hvitvin has sødme

-- Drop existing function first to allow return type changes
DROP FUNCTION IF EXISTS find_similar_wines_weighted(numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text[],text,integer);

CREATE OR REPLACE FUNCTION find_similar_wines_weighted(
  p_avg_fylde NUMERIC,
  p_avg_friskhet NUMERIC,
  p_avg_snaerp NUMERIC,
  p_avg_sodme NUMERIC,
  p_weight_fylde NUMERIC,
  p_weight_friskhet NUMERIC,
  p_weight_snaerp NUMERIC,
  p_weight_sodme NUMERIC,
  p_excluded_codes TEXT[],
  p_main_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
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
    -- Calculate weighted numeric similarity score based on wine category
    -- Rødvin: uses garvestoff (not sødme), Hvitvin/Musserende: uses sødme (not garvestoff)
    CASE 
      WHEN w.main_category = 'Rødvin' THEN
        (
          -- Fylde similarity (0-100 scale)
          COALESCE((100 - LEAST(ABS(p_avg_fylde - w.fylde) * 20, 100)) * p_weight_fylde, 50 * p_weight_fylde) +
          -- Friskhet similarity
          COALESCE((100 - LEAST(ABS(p_avg_friskhet - w.friskhet) * 20, 100)) * p_weight_friskhet, 50 * p_weight_friskhet) +
          -- Garvestoff similarity (only for Rødvin)
          COALESCE((100 - LEAST(ABS(p_avg_snaerp - w.garvestoff) * 20, 100)) * p_weight_snaerp, 50 * p_weight_snaerp)
        ) / (p_weight_fylde + p_weight_friskhet + p_weight_snaerp)
      ELSE
        -- Hvitvin and Musserende vin
        (
          -- Fylde similarity
          COALESCE((100 - LEAST(ABS(p_avg_fylde - w.fylde) * 20, 100)) * p_weight_fylde, 50 * p_weight_fylde) +
          -- Friskhet similarity
          COALESCE((100 - LEAST(ABS(p_avg_friskhet - w.friskhet) * 20, 100)) * p_weight_friskhet, 50 * p_weight_friskhet) +
          -- Sødme similarity (only for Hvitvin/Musserende)
          COALESCE((100 - LEAST(ABS(p_avg_sodme - w.sodme) * 20, 100)) * p_weight_sodme, 50 * p_weight_sodme)
        ) / (p_weight_fylde + p_weight_friskhet + p_weight_sodme)
    END AS numeric_score
  FROM wines w
  WHERE 
    -- Exclude already tasted wines
    NOT (w.product_id = ANY(p_excluded_codes))
    -- Filter by category if specified, or allow all categories
    AND (p_main_category IS NULL OR w.main_category = p_main_category)
    -- Only include wines with at least some characteristic data
    AND (w.fylde IS NOT NULL OR w.friskhet IS NOT NULL OR w.garvestoff IS NOT NULL OR w.sodme IS NOT NULL)
  ORDER BY numeric_score DESC
  LIMIT p_limit;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION find_similar_wines_weighted IS 
'Finds wines similar to user preferences based on weighted numeric characteristics. Handles category-specific attributes: Rødvin uses garvestoff, Hvitvin/Musserende use sødme.';
