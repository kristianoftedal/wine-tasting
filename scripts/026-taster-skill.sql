-- =============================================================================
-- MIGRATION 026: Skill across tastings (bert-integration-plan.md, phase 13)
--
-- A single score mixes the taster's skill with the wine's difficulty and the
-- quality of one Vinmonopolet note. Difficulty is estimated per wine and field
-- as the mean score across everyone who tasted it, shrunk toward the global
-- mean when few did; skill is a taster's mean residual (score − difficulty),
-- shrunk toward 0 the same way. k = 5 in both places.
--
-- Scores from different scorer versions are never mixed: a row's
-- scorer_version (null = the directional scorer that produced every score
-- before migration 025) is part of every grouping. History is read-only; the
-- views are recomputed on read and store nothing.
--
-- Row-level security on tastings lets a user see only their own rows and
-- those in their groups' events, but difficulty needs *every* tasting of a
-- wine. The views therefore run as their owner, are not exposed to clients,
-- and the only entry point is my_taster_skill(), SECURITY DEFINER, which
-- returns the caller's own rows and nothing else.
--
-- Apply after 025.
-- =============================================================================

CREATE OR REPLACE VIEW tasting_field_scores AS
  SELECT id AS tasting_id, user_id, wine_id,
         COALESCE(scorer_version, 'directional-1:text-embedding-3-small') AS scorer_version,
         'lukt' AS field, smell_score::numeric AS score
  FROM tastings WHERE smell_score IS NOT NULL AND wine_id IS NOT NULL
  UNION ALL
  SELECT id, user_id, wine_id,
         COALESCE(scorer_version, 'directional-1:text-embedding-3-small'),
         'smak', taste_score::numeric
  FROM tastings WHERE taste_score IS NOT NULL AND wine_id IS NOT NULL;

CREATE OR REPLACE VIEW wine_difficulty AS
  WITH global AS (
    SELECT scorer_version, field, AVG(score) AS global_mean
    FROM tasting_field_scores GROUP BY scorer_version, field
  )
  SELECT s.scorer_version, s.field, s.wine_id,
         COUNT(*)::int AS n,
         AVG(s.score) AS raw_mean,
         (COUNT(*) * AVG(s.score) + 5 * g.global_mean) / (COUNT(*) + 5) AS difficulty
  FROM tasting_field_scores s
  JOIN global g USING (scorer_version, field)
  GROUP BY s.scorer_version, s.field, s.wine_id, g.global_mean;

CREATE OR REPLACE VIEW taster_skill AS
  SELECT s.user_id, s.scorer_version,
         COUNT(DISTINCT s.tasting_id)::int AS tastings,
         COUNT(*)::int AS fields,
         AVG(s.score - d.difficulty) AS raw_residual,
         (COUNT(*) * AVG(s.score - d.difficulty)) / (COUNT(*) + 5) AS skill
  FROM tasting_field_scores s
  JOIN wine_difficulty d USING (scorer_version, field, wine_id)
  GROUP BY s.user_id, s.scorer_version;

REVOKE ALL ON tasting_field_scores, wine_difficulty, taster_skill FROM anon, authenticated;

CREATE OR REPLACE FUNCTION my_taster_skill()
RETURNS TABLE (scorer_version text, tastings int, fields int, raw_residual numeric, skill numeric)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT scorer_version, tastings, fields, raw_residual, skill
  FROM taster_skill
  WHERE user_id = auth.uid()
  ORDER BY tastings DESC;
$$;

REVOKE ALL ON FUNCTION my_taster_skill() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_taster_skill() TO authenticated;

COMMENT ON VIEW taster_skill IS
  'Mean residual against shrunk wine difficulty, shrunk toward 0 (k=5), per taster and scorer version. Read via my_taster_skill().';
