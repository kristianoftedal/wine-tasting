-- =============================================================================
-- MIGRATION 024: Editorial review trail for enriched wine notes
--
-- 023 added the generated notes and a status. It did not record who decided.
-- Approving a note promotes it to reference data the scoring engine grades
-- people against, so the decision needs an author and a timestamp — otherwise
-- the only evidence a note was ever reviewed is that its status changed.
--
-- Apply after 023.
-- =============================================================================

ALTER TABLE wines ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN wines.reviewed_at IS
  'When a human approved or rejected the enriched note. Null while pending.';
COMMENT ON COLUMN wines.reviewed_by IS
  'Which profile made the call. Null for rows the pipeline itself marked failed.';

-- The review queue: pending rows, oldest first. Small and stays small.
CREATE INDEX IF NOT EXISTS idx_wines_enrichment_review
  ON wines (enriched_at)
  WHERE enrichment_status = 'pending';
