-- Migration: Convert grapes column from TEXT (JSON string) to TEXT[] (PostgreSQL array)
-- This ensures the grapes field is properly typed as an array in the database

-- Step 1: Add a temporary column for the array data
ALTER TABLE wines ADD COLUMN grapes_array TEXT[];

-- Step 2: Convert JSON string to PostgreSQL array
-- Handle both JSON array format '["grape1", "grape2"]' and NULL values
UPDATE wines
SET grapes_array = (
  CASE 
    WHEN grapes IS NULL THEN NULL
    WHEN grapes = '' THEN NULL
    WHEN grapes = '[]' THEN '{}'::TEXT[]
    ELSE (
      SELECT ARRAY_AGG(elem::TEXT)
      FROM jsonb_array_elements_text(grapes::JSONB) AS elem
    )
  END
)
WHERE grapes IS NOT NULL AND grapes != '';

-- Step 3: Drop the old column
ALTER TABLE wines DROP COLUMN grapes;

-- Step 4: Rename the new column to grapes
ALTER TABLE wines RENAME COLUMN grapes_array TO grapes;

-- Add comment
COMMENT ON COLUMN wines.grapes IS 'Array of grape varieties used in the wine';
