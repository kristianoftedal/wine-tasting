-- =============================================================================
-- MIGRATION 023: Wine note enrichment
--
-- 18.7% of Vinmonopolet taste notes name no aroma at all and 23.5% name only
-- one. The scoring engine drops the unscoreable ones from the weighted average
-- (src/lib/flavourScoring.ts), which means two wines tasted at the same event
-- can be graded on a different number of components. The thin ones are worse:
-- they are scored, but a taster facing "Duft av røde bær." can earn at most one
-- direct hit however well they taste.
--
-- This migration adds enriched notes alongside the imported ones. It does NOT
-- overwrite smell/taste. Vinmonopolet's text is the catalogue of record and a
-- re-import must never have to reconcile with generated prose, so the enriched
-- text lives in its own columns behind a review status.
--
-- Nothing reads these columns for scoring yet. Flipping a wine to
-- enrichment_status = 'approved' is a deliberate editorial act.
-- =============================================================================

ALTER TABLE wines ADD COLUMN IF NOT EXISTS smell_enriched      TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS taste_enriched      TEXT;

-- pending  : generated, passed the style gate, awaiting review
-- approved : cleared for use as a scoring reference
-- rejected : reviewed and turned down; do not regenerate automatically
-- failed   : the pipeline could not produce a note that passed the gate
ALTER TABLE wines ADD COLUMN IF NOT EXISTS enrichment_status   TEXT
  CHECK (enrichment_status IN ('pending', 'approved', 'rejected', 'failed'));

-- [{ url, title }] — the sources the research step actually cited. Kept so a
-- reviewer can check a claim without rerunning the pipeline.
ALTER TABLE wines ADD COLUMN IF NOT EXISTS enrichment_sources  JSONB;

-- { model, researchModel, before: {...}, after: {...}, problems: [...] }
-- Before/after are the noteQuality assessments, so a regression is visible in
-- the data rather than only in a log line.
ALTER TABLE wines ADD COLUMN IF NOT EXISTS enrichment_meta     JSONB;

ALTER TABLE wines ADD COLUMN IF NOT EXISTS enriched_at         TIMESTAMPTZ;

-- The batch runner's working set: everything not yet attempted, ordered by how
-- badly the note handicaps a taster. Partial index keeps it small once most of
-- the catalogue has been processed.
CREATE INDEX IF NOT EXISTS idx_wines_enrichment_pending
  ON wines (enriched_at)
  WHERE enrichment_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_wines_enrichment_status
  ON wines (enrichment_status)
  WHERE enrichment_status IS NOT NULL;

COMMENT ON COLUMN wines.smell_enriched IS
  'Generated smell note in Vinmonopolet house style. Never overwrites wines.smell.';
COMMENT ON COLUMN wines.taste_enriched IS
  'Generated taste note in Vinmonopolet house style. Never overwrites wines.taste.';
COMMENT ON COLUMN wines.enrichment_status IS
  'pending | approved | rejected | failed. Only approved notes are cleared for scoring use.';
