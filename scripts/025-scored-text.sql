-- 025: forward-only bookkeeping for tasting scores.
--
-- The smell/taste score is computed on the selected flavour chips joined with
-- the free text, but only the free text was stored, so a stored score could not
-- always be reproduced from the row. These columns record exactly what was
-- scored and by which scorer version (src/lib/scoringConfig.ts SCORER_VERSION).
--
-- Nullable and never backfilled: existing rows are left exactly as they are.
-- Tasting history is read-only by decision; see bert-integration-plan.md.

ALTER TABLE tastings
  ADD COLUMN IF NOT EXISTS lukt_scored    TEXT,
  ADD COLUMN IF NOT EXISTS smak_scored    TEXT,
  ADD COLUMN IF NOT EXISTS scorer_version TEXT;

COMMENT ON COLUMN tastings.lukt_scored    IS 'Chip names + free text the smell score was computed on. Null for rows before migration 025.';
COMMENT ON COLUMN tastings.smak_scored    IS 'Chip names + free text the taste score was computed on. Null for rows before migration 025.';
COMMENT ON COLUMN tastings.scorer_version IS 'SCORER_VERSION that produced smell_score/taste_score. Null = directional-1 or earlier; never rewritten.';
