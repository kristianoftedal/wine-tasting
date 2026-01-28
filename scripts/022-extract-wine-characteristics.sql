-- Migration: Extract wine characteristics from content.characteristics JSONB array
-- This extracts Fylde, Friskhet, Garvestoff (Garvestoffer), and Sødme into separate numeric columns
-- and removes them from the JSONB array to avoid data duplication
-- Note: Only Rødvin has garvestoff, Rødvin does NOT have sødme

-- Step 1: Add new columns for characteristics (stored as numeric values)
ALTER TABLE wines ADD COLUMN IF NOT EXISTS fylde NUMERIC(3, 1);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS friskhet NUMERIC(3, 1);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS garvestoff NUMERIC(3, 1);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS sodme NUMERIC(3, 1);

-- Step 2: Create a function to extract characteristic value by name (case-insensitive)
CREATE OR REPLACE FUNCTION get_characteristic_value(content_json JSONB, characteristic_name TEXT)
RETURNS NUMERIC AS $$
DECLARE
  characteristic JSONB;
  value_text TEXT;
  characteristics_array JSONB;
  key_name TEXT;
BEGIN
  -- Find characteristics array regardless of case (characteristics or Characteristics)
  SELECT k INTO key_name
  FROM jsonb_object_keys(content_json) k
  WHERE LOWER(k) = 'characteristics'
  LIMIT 1;
  
  -- Return NULL if no characteristics found or not an array
  IF key_name IS NULL OR jsonb_typeof(content_json->key_name) != 'array' THEN
    RETURN NULL;
  END IF;
  
  characteristics_array := content_json->key_name;
  
  -- Find the characteristic in the array using case-insensitive matching for both key and value
  SELECT elem INTO characteristic
  FROM jsonb_array_elements(characteristics_array) elem,
       jsonb_each_text(elem) kv
  WHERE LOWER(kv.key) IN ('name', 'readablevalue') 
    AND LOWER(kv.value) LIKE '%' || LOWER(characteristic_name) || '%'
  LIMIT 1;
  
  -- Extract value field regardless of case
  IF characteristic IS NOT NULL THEN
    SELECT kv.value INTO value_text
    FROM jsonb_each_text(characteristic) kv
    WHERE LOWER(kv.key) = 'value'
    LIMIT 1;
    
    -- Try to convert to numeric, return NULL if conversion fails
    BEGIN
      RETURN value_text::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Migrate data - extract values from content.characteristics
-- Only extract garvestoff for Rødvin, only extract sødme for non-Rødvin
UPDATE wines 
SET 
  fylde = get_characteristic_value(content, 'fylde'),
  friskhet = get_characteristic_value(content, 'friskhet'),
  garvestoff = CASE 
    WHEN LOWER(main_category) = 'rødvin' THEN get_characteristic_value(content, 'garvestoff')
    ELSE NULL 
  END,
  sodme = CASE 
    WHEN LOWER(main_category) != 'rødvin' THEN get_characteristic_value(content, 'sødme')
    ELSE NULL 
  END
WHERE content IS NOT NULL;

-- Step 4: Remove extracted characteristics from the JSONB array (case-insensitive)
-- Fixed key_name scope issue and handle wine categories correctly
UPDATE wines w
SET content = (
  SELECT jsonb_set(
    w.content,
    ARRAY[char_key.key_name],
    filtered_chars.filtered_array
  )
  FROM (
    SELECT k as key_name
    FROM jsonb_object_keys(w.content) k
    WHERE LOWER(k) = 'characteristics' 
      AND jsonb_typeof(w.content->k) = 'array'
    LIMIT 1
  ) char_key,
  LATERAL (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) as filtered_array
    FROM jsonb_array_elements(w.content->char_key.key_name) elem
    WHERE NOT EXISTS (
      SELECT 1 
      FROM jsonb_each_text(elem) kv
      WHERE LOWER(kv.key) IN ('name', 'readablevalue')
        AND (
          LOWER(kv.value) LIKE '%fylde%' OR
          LOWER(kv.value) LIKE '%friskhet%' OR
          (LOWER(w.main_category) = 'rødvin' AND LOWER(kv.value) LIKE '%garvestoff%') OR
          (LOWER(w.main_category) != 'rødvin' AND LOWER(kv.value) LIKE '%sødme%')
        )
    )
  ) filtered_chars
  WHERE char_key.key_name IS NOT NULL
)
WHERE content IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_object_keys(content) k 
    WHERE LOWER(k) = 'characteristics' 
      AND jsonb_typeof(content->k) = 'array'
  );

-- Step 5: Create indexes for the new columns (useful for filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_wines_fylde ON wines(fylde) WHERE fylde IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wines_friskhet ON wines(friskhet) WHERE friskhet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wines_garvestoff ON wines(garvestoff) WHERE garvestoff IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wines_sodme ON wines(sodme) WHERE sodme IS NOT NULL;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN wines.fylde IS 'Body/fullness extracted from content.characteristics (numeric scale) - All wine types';
COMMENT ON COLUMN wines.friskhet IS 'Freshness/acidity extracted from content.characteristics (numeric scale) - All wine types';
COMMENT ON COLUMN wines.garvestoff IS 'Tannin extracted from content.characteristics (numeric scale) - Rødvin only';
COMMENT ON COLUMN wines.sodme IS 'Sweetness extracted from content.characteristics (numeric scale) - Hvitvin and Musserende vin only';

-- Step 7: Verify the migration
-- This query shows wines with extracted characteristics and verifies removal from JSONB
-- SELECT product_id, name, main_category, fylde, friskhet, garvestoff, sodme, 
--        jsonb_array_length(content->'characteristics') as remaining_characteristics
-- FROM wines 
-- WHERE fylde IS NOT NULL OR friskhet IS NOT NULL OR garvestoff IS NOT NULL OR sodme IS NOT NULL
-- LIMIT 10;
