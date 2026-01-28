-- Migration: Convert main_category, district, sub_district, main_country, main_producer from JSONB to TEXT
-- This extracts the 'name' property from each JSON object and stores it as text

-- Step 1: Add new temporary columns
ALTER TABLE wines ADD COLUMN IF NOT EXISTS main_category_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS district_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS sub_district_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS main_country_new TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS main_producer_new TEXT;

-- Step 2: Migrate data - extract 'name' from JSON
UPDATE wines SET main_category_new = (main_category->>'name')::TEXT WHERE main_category IS NOT NULL;
UPDATE wines SET district_new = (district->>'name')::TEXT WHERE district IS NOT NULL;
UPDATE wines SET sub_district_new = (sub_district->>'name')::TEXT WHERE sub_district IS NOT NULL;
UPDATE wines SET main_country_new = (main_country->>'name')::TEXT WHERE main_country IS NOT NULL;
UPDATE wines SET main_producer_new = (main_producer->>'name')::TEXT WHERE main_producer IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE wines DROP COLUMN IF EXISTS main_category;
ALTER TABLE wines DROP COLUMN IF EXISTS district;
ALTER TABLE wines DROP COLUMN IF EXISTS sub_district;
ALTER TABLE wines DROP COLUMN IF EXISTS main_country;
ALTER TABLE wines DROP COLUMN IF EXISTS main_producer;

-- Step 4: Rename new columns
ALTER TABLE wines RENAME COLUMN main_category_new TO main_category;
ALTER TABLE wines RENAME COLUMN district_new TO district;
ALTER TABLE wines RENAME COLUMN sub_district_new TO sub_district;
ALTER TABLE wines RENAME COLUMN main_country_new TO main_country;
ALTER TABLE wines RENAME COLUMN main_producer_new TO main_producer;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN wines.main_category IS 'Wine category name (e.g., "Rødvin", "Hvitvin", "Musserende vin")';
COMMENT ON COLUMN wines.district IS 'Wine district name';
COMMENT ON COLUMN wines.sub_district IS 'Wine sub-district name';
COMMENT ON COLUMN wines.main_country IS 'Wine country of origin name';
COMMENT ON COLUMN wines.main_producer IS 'Wine producer name';
