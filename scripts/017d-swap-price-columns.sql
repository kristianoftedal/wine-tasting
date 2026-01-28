-- Step 3a: Drop old price column and rename new one
ALTER TABLE wines DROP COLUMN IF EXISTS price;
ALTER TABLE wines RENAME COLUMN price_new TO price;
COMMENT ON COLUMN wines.price IS 'Wine price value as text (e.g., "299.90")';
