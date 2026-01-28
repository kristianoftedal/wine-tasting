-- Step 2b: Migrate volume data - extract value from JSON
UPDATE wines 
SET volume_new = (volume->>'value')::TEXT
WHERE volume IS NOT NULL AND volume_new IS NULL;
