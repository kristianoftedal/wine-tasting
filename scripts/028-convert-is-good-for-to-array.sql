-- Migration: Convert is_good_for column from TEXT (JSON string) to TEXT[] (PostgreSQL array)
-- This allows Supabase to return proper JavaScript arrays instead of JSON strings

-- Step 1: Add new column with TEXT[] type
ALTER TABLE wines ADD COLUMN is_good_for_array TEXT[];

-- Step 2: Migrate existing JSON string data to array format
-- Parse the JSON array string and convert to PostgreSQL array
UPDATE wines
SET is_good_for_array = (
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(is_good_for::jsonb)
  )
)
WHERE is_good_for IS NOT NULL 
  AND is_good_for != '' 
  AND is_good_for != '[]'
  AND is_good_for != 'null';

-- Step 3: Drop the old column
ALTER TABLE wines DROP COLUMN is_good_for;

-- Step 4: Rename new column to original name
ALTER TABLE wines RENAME COLUMN is_good_for_array TO is_good_for;

-- Add comment for documentation
COMMENT ON COLUMN wines.is_good_for IS 'Array of food pairings/occasions the wine is good for';
