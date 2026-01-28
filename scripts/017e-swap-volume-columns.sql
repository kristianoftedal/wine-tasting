-- Step 3b: Drop old volume column and rename new one
ALTER TABLE wines DROP COLUMN IF EXISTS volume;
ALTER TABLE wines RENAME COLUMN volume_new TO volume;
COMMENT ON COLUMN wines.volume IS 'Wine volume value as text (e.g., "75")';
