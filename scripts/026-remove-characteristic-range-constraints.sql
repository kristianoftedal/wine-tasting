-- Migration: Remove range check constraints from wine characteristics
-- These constraints were too restrictive and prevented flexible data entry

-- Drop the range check constraints for fylde, friskhet, garvestoff, and sodme
ALTER TABLE wines DROP CONSTRAINT IF EXISTS check_fylde_range;
ALTER TABLE wines DROP CONSTRAINT IF EXISTS check_friskhet_range;
ALTER TABLE wines DROP CONSTRAINT IF EXISTS check_garvestoff_range;
ALTER TABLE wines DROP CONSTRAINT IF EXISTS check_sodme_range;

COMMENT ON COLUMN wines.fylde IS 'Fylde (body) characteristic - integer value, typically 1-12';
COMMENT ON COLUMN wines.friskhet IS 'Friskhet (freshness) characteristic - integer value, typically 1-12';
COMMENT ON COLUMN wines.garvestoff IS 'Garvestoff (tannin) characteristic for red wines - integer value, typically 1-12';
COMMENT ON COLUMN wines.sodme IS 'Sødme (sweetness) characteristic for white/sparkling wines - integer value, typically 1-12';
