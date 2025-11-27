-- This script recalculates all tasting scores based on the Summary.tsx logic
-- Scores should be on a 0-100 scale (percentages)
-- Karakter values should be transformed from 1-6 to 1-10 scale

-- Transform karakter from 1-6 scale to 1-10 scale
UPDATE tastings
SET karakter = ROUND(((karakter - 1) * 9 / 5) + 1)
WHERE karakter IS NOT NULL AND karakter <= 6;

-- Note: The complex score calculations (semantic similarity, numeric comparisons)
-- require the full wine data and cannot be done in pure SQL.
-- The recalculate-tasting-scores.mjs script handles this properly.
-- This script only handles the karakter transformation.
