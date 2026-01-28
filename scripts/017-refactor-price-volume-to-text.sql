-- Migration: Convert price and volume columns from JSONB to TEXT
-- This extracts the 'value' from the JSON object and stores it as text

-- Step 1: Add new temporary columns
ALTER TABLE wines ADD COLUMN IF NOT EXISTS price_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS volume_new TEXT;

-- Step 2: Migrate data - extract value from JSON
UPDATE wines 
SET price_new = (price->>'value')::TEXT
WHERE price IS NOT NULL;

UPDATE wines 
SET volume_new = (volume->>'value')::TEXT
WHERE volume IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE wines DROP COLUMN IF EXISTS price;
ALTER TABLE wines DROP COLUMN IF EXISTS volume;

-- Step 4: Rename new columns
ALTER TABLE wines RENAME COLUMN price_new TO price;
ALTER TABLE wines RENAME COLUMN volume_new TO volume;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN wines.price IS 'Wine price value as text (e.g., "299.90")';
COMMENT ON COLUMN wines.volume IS 'Wine volume value as text (e.g., "75")';
