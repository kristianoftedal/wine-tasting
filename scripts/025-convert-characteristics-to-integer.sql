-- Migration: Convert wine characteristics from NUMERIC to INTEGER
-- These columns store values on a 1-12 scale and should be integers
-- Current: NUMERIC(3,1) - allows decimals like 8.5
-- Target: INTEGER - whole numbers only

-- Step 1: Round existing decimal values to integers
UPDATE wines
SET 
  fylde = ROUND(fylde),
  friskhet = ROUND(friskhet),
  garvestoff = ROUND(garvestoff),
  sodme = ROUND(sodme)
WHERE fylde IS NOT NULL OR friskhet IS NOT NULL OR garvestoff IS NOT NULL OR sodme IS NOT NULL;

-- Step 2: Convert columns from NUMERIC to INTEGER
ALTER TABLE wines 
  ALTER COLUMN fylde TYPE INTEGER USING ROUND(fylde)::INTEGER,
  ALTER COLUMN friskhet TYPE INTEGER USING ROUND(friskhet)::INTEGER,
  ALTER COLUMN garvestoff TYPE INTEGER USING ROUND(garvestoff)::INTEGER,
  ALTER COLUMN sodme TYPE INTEGER USING ROUND(sodme)::INTEGER;

-- Removed check constraints for range validation

-- Add comments
COMMENT ON COLUMN wines.fylde IS 'Body/fullness rating (1-12 scale, integer)';
COMMENT ON COLUMN wines.friskhet IS 'Freshness/acidity rating (1-12 scale, integer)';
COMMENT ON COLUMN wines.garvestoff IS 'Tannin rating (1-12 scale, integer) - Red wines only';
COMMENT ON COLUMN wines.sodme IS 'Sweetness rating (1-12 scale, integer) - White/Sparkling wines only';
