-- Step 1: Add new temporary columns
ALTER TABLE wines ADD COLUMN IF NOT EXISTS price_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS volume_new TEXT;
