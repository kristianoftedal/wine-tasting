-- =============================================================================
-- MIGRATION 021: Wine search overhaul
--
-- Fixes four classes of defect in search_wines_fuzzy (migration 020):
--
--   A. CRASH  Vinmonopolet stores volume as "37,5 cl" (comma decimal). The
--             split_part(...)::numeric cast in the projection raises
--             "invalid input syntax for type numeric: 37,5" whenever a matching
--             row is a half-bottle (~1.5% of 50k rows). Because broad typeahead
--             prefixes match those rows constantly, the RPC failed on nearly
--             every keystroke; the app then silently fell back to a plain ILIKE
--             on name, which is accent-blind -- so "andre clouet" returned
--             nothing for "André Clouet".
--
--   B. NULLS  price is stored as 'Kr' + U+00A0 + '1' + U+00A0 + '224,90'.
--             split_part(price, ' ', 2) splits on a REGULAR space, so it
--             returned '' for every row: price was always NULL. Splitting on
--             NBSP alone would then truncate "Kr 1 224,90" to 1.
--
--   C. RANK   similarity(name, query) is length-normalised over both strings,
--             so a short query against a long name scores below the 0.3 pg_trgm
--             threshold -- "clouet" could never reach "André Clouet Rosé".
--             Nothing matched product_id either, despite the UI promising
--             "navn eller ID", and grapes/sub-district were not searchable.
--
--   D. DUPES  The live table holds duplicate (product_id, year) rows despite
--             the unique constraint in scripts/schema.sql, so results repeated.
--
-- Strategy: parse the messy source text ONCE into stored numeric and folded
-- columns, then make the search function pure comparison -- no casting, so it
-- cannot crash -- with an explicit tier ladder instead of a single
-- length-normalised trigram score.
--
-- NOTE ON SCHEMA DRIFT: scripts/schema.sql and migration 017 describe a
-- `content` JSONB column and JSONB-wrapped category/country/district values.
-- The live table has none of that. Its actual shape is flat TEXT columns plus
-- `grapes` and `is_good_for` JSON arrays. This migration targets the live
-- shape, verified against production, and touches nothing that only exists on
-- paper. It also leaves the existing search_text trigger alone rather than
-- re-declaring generate_wine_search_text(), whose deployed body no longer
-- matches the copy in migration 017.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Diacritic + Norwegian folding.
--    Self-contained (no unaccent extension, no regdictionary search_path
--    hazard) and honestly IMMUTABLE, so it is safe to index.
--
--    The translate() map lists BOTH cases of every accented letter and maps
--    them straight to lowercase ASCII rather than relying on lower() to fold
--    case first. That is deliberate: lower() is collation-dependent, and in a
--    C-locale database lower('É') returns 'É' unchanged -- a
--    lower()-then-translate order would silently fail on uppercase accents.
--    Ligatures need replace() because translate() is strictly 1:1.
--
--    Must stay in lockstep with foldSearchQuery() in src/lib/validation.ts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wine_fold(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT btrim(regexp_replace(
    lower(translate(
      replace(replace(replace(replace(replace(coalesce(t, ''),
        'Æ', 'ae'), 'æ', 'ae'), 'Œ', 'oe'), 'œ', 'oe'), 'ß', 'ss'),
      'áÁàÀâÂäÄãÃåÅăĂāĀąĄǎǍéÉèÈêÊëËēĒėĖęĘěĚíÍìÌîÎïÏīĪįĮǐǏóÓòÒôÔöÖõÕőŐøØōŌǒǑúÚùÙûÛüÜűŰūŪųŲǔǓçÇćĆčČĉĈñÑńŃňŇņŅšŠşŞșȘśŚŝŜýÝÿŸŷŶžŽźŹżŻđĐďĎðÐťŤțȚþÞĺĹłŁľĽřŘŕŔğĞĝĜģĢķĶĥĤŵŴḃḂ',
      'aaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiiiiiiiiiiiioooooooooooooooooouuuuuuuuuuuuuuuuccccccccnnnnnnnnssssssssssyyyyyyzzzzzzddddddttttttllllllrrrrggggggkkhhwwbb')),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- 2. Bulletproof numeric parsing.
--    "37,5 cl"     -> 37.5
--    "75 cl"       -> 75
--    "Kr 519,90"   -> 519.90   (NBSP after Kr)
--    "Kr 1 224,90" -> 1224.90  (NBSP thousands separator; previously NULL)
--    The EXCEPTION block guarantees that no future input shape can break a
--    backfill, a trigger, or a search again.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wine_parse_amount(t TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;

  cleaned := replace(t, U&'\00A0', '');   -- NBSP thousands separator
  cleaned := replace(cleaned, ' ', '');   -- regular thousands separator
  cleaned := replace(cleaned, ',', '.');  -- comma decimal -> dot decimal
  cleaned := regexp_replace(cleaned, '[^0-9.]', '', 'g');
  cleaned := regexp_replace(cleaned, '\.(?=.*\.)', '', 'g'); -- keep the last dot only
  cleaned := btrim(cleaned, '.');

  RETURN NULLIF(cleaned, '')::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Compact, folded metadata string for typeahead.
--
--    Includes producer, country, district, sub-district, category and grapes --
--    grape search does not work at all today, because the deployed
--    search_text never received it.
--
--    Deliberately EXCLUDES the prose columns (color, smell, taste,
--    general_description) and is_good_for. That prose is what made
--    word_similarity() both slow (long strings) and noisy: a query could match
--    "Passer til aromatisk mat ...". Prose and food pairing stay in search_text
--    for the food-pairing feature, which is a different search with different
--    goals.
--
--    grapes/is_good_for are cast to ::text rather than unnested, which makes
--    this indifferent to whether they are stored as jsonb or text[] -- either
--    serialisation folds to the same word list once punctuation is collapsed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_wine_search_meta(wine wines)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT wine_fold(concat_ws(' ',
    wine.main_producer,
    wine.main_country,
    wine.district,
    wine.sub_district,
    wine.main_category,
    wine.grapes::text
  ))
$$;

-- -----------------------------------------------------------------------------
-- 4. Stored search + display columns
-- -----------------------------------------------------------------------------
ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS search_name   TEXT,
  ADD COLUMN IF NOT EXISTS search_meta   TEXT,
  ADD COLUMN IF NOT EXISTS search_tokens TEXT[],
  ADD COLUMN IF NOT EXISTS volume_cl     NUMERIC,
  ADD COLUMN IF NOT EXISTS price_nok     NUMERIC;

UPDATE wines SET
  search_name   = wine_fold(wines.name),
  search_meta   = generate_wine_search_meta(wines.*),
  search_tokens = string_to_array(
                    btrim(wine_fold(wines.name) || ' ' ||
                          generate_wine_search_meta(wines.*)), ' '),
  volume_cl     = wine_parse_amount(wines.volume::text),
  price_nok     = wine_parse_amount(wines.price::text);

-- A separate trigger from the existing wines_search_text_sync, which keeps
-- owning search_text. Two BEFORE triggers coexist fine and this avoids
-- re-declaring a function whose deployed body we cannot see.
CREATE OR REPLACE FUNCTION wines_update_search_index()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_name   := wine_fold(NEW.name);
  NEW.search_meta   := generate_wine_search_meta(NEW);
  NEW.search_tokens := string_to_array(btrim(NEW.search_name || ' ' || NEW.search_meta), ' ');
  NEW.volume_cl     := wine_parse_amount(NEW.volume::text);
  NEW.price_nok     := wine_parse_amount(NEW.price::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wines_search_index_sync ON wines;
CREATE TRIGGER wines_search_index_sync
  BEFORE INSERT OR UPDATE OF name, main_category, main_country, main_producer,
    district, sub_district, grapes, volume, price
  ON wines
  FOR EACH ROW EXECUTE FUNCTION wines_update_search_index();

-- -----------------------------------------------------------------------------
-- 5. Indexes.
--    GIN trigram serves LIKE '%q%' and the <% word-similarity operator.
--    GIN on search_tokens serves the out-of-order multi-token tier (@>).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wines_search_name_trgm
  ON wines USING GIN (search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wines_search_meta_trgm
  ON wines USING GIN (search_meta gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wines_search_tokens
  ON wines USING GIN (search_tokens);
CREATE INDEX IF NOT EXISTS idx_wines_product_id
  ON wines (product_id);

-- -----------------------------------------------------------------------------
-- 6. The search function.
--
--    No casting in the projection, so it cannot crash. A tier ladder replaces
--    the single length-normalised trigram score:
--
--      1.00  product_id is exactly the typed digits
--      0.98  folded name matches exactly
--      0.92  folded name starts with the query      ("andre cl" -> André Clouet ...)
--      0.85  query starts a word inside the name    ("clouet"   -> André Clouet Rosé)
--      0.80  all query tokens present, any order    ("clouet andre")
--      0.75  query is a substring of the name
--      0.60x fuzzy trigram on name                  (typos: "andre clouett")
--      0.50  query is a substring of the metadata   ("barolo", "champagne", "riesling")
--      0.40x fuzzy trigram on metadata
--
--    Each tier is a separately bounded, index-backed branch. Scoring every
--    match in one OR-scan and then sorting is what a broad prefix like
--    "champagne" cannot afford; an unordered LIMIT over such a scan would
--    instead return an arbitrary handful of rows.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_wines_fuzzy(text, integer);

CREATE OR REPLACE FUNCTION search_wines_fuzzy(
  search_query  TEXT,
  result_limit  INTEGER
)
RETURNS TABLE (
  id            UUID,
  product_id    TEXT,
  name          TEXT,
  year          TEXT,
  volume        NUMERIC,
  main_category TEXT,
  main_country  TEXT,
  district      TEXT,
  price         NUMERIC,
  similarity    FLOAT
)
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  WITH q AS (
    SELECT
      wine_fold(search_query)                                  AS n,
      NULLIF(regexp_replace(search_query, '\D', '', 'g'), '')  AS digits,
      string_to_array(wine_fold(search_query), ' ')            AS toks
  ),
  cand AS (
    SELECT id, score FROM (
      (SELECT w.id, 1.00::float AS score FROM wines w, q
         WHERE q.digits IS NOT NULL AND w.product_id = q.digits LIMIT 10)
      UNION ALL
      (SELECT w.id, 0.98 FROM wines w, q WHERE w.search_name = q.n LIMIT 40)
      UNION ALL
      (SELECT w.id, 0.92 FROM wines w, q WHERE w.search_name LIKE q.n || '%' LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.85 FROM wines w, q WHERE w.search_name LIKE '% ' || q.n || '%' LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.80 FROM wines w, q WHERE w.search_tokens @> q.toks LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.75 FROM wines w, q WHERE w.search_name LIKE '%' || q.n || '%' LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.60 * word_similarity(q.n, w.search_name)
         FROM wines w, q WHERE q.n <% w.search_name LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.50 FROM wines w, q WHERE w.search_meta LIKE '%' || q.n || '%' LIMIT 60)
      UNION ALL
      (SELECT w.id, 0.40 * word_similarity(q.n, w.search_meta)
         FROM wines w, q WHERE q.n <% w.search_meta LIMIT 60)
    ) tiers
  ),
  best AS (
    SELECT c.id, MAX(c.score) AS score FROM cand c GROUP BY c.id
  ),
  deduped AS (
    SELECT DISTINCT ON (w.product_id, COALESCE(w.year, ''))
      w.id, w.product_id, w.name, w.year, w.volume_cl, w.price_nok,
      w.main_category, w.main_country, w.district, b.score
    FROM best b JOIN wines w ON w.id = b.id
    ORDER BY w.product_id, COALESCE(w.year, ''), b.score DESC, w.id
  )
  SELECT
    d.id, d.product_id, d.name, d.year, d.volume_cl,
    d.main_category, d.main_country, d.district,
    d.price_nok, d.score
  FROM deduped d
  WHERE d.score >= 0.30
  -- Within a tier, prefer the shorter name: at equal score it is the closer
  -- match, so "André Clouet Rosé" outranks "André Clouet Brut Millésime 2020"
  -- for the query "andre clouet". Name last, purely so ordering is stable.
  ORDER BY d.score DESC, length(d.name), d.name
  LIMIT result_limit;
$$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 7. REQUIRED post-deploy step. Run this separately -- VACUUM cannot run inside
--    a transaction block.
--
--    The backfill in step 4 rewrites all ~50k rows, leaving the heap bloated
--    and the planner statistics stale. Measured on a local copy of the full
--    table: p50 51ms / p95 222ms before, p50 5.5ms / p95 11.5ms after. Skipping
--    this makes the new search look ten times slower than it is.
-- -----------------------------------------------------------------------------
-- VACUUM (ANALYZE) wines;

-- Post-deploy sanity checks (scripts/verify-search-migration.ts asserts these):
--   SELECT name, similarity FROM search_wines_fuzzy('andre clouet', 10);
--   SELECT name, similarity FROM search_wines_fuzzy('clouet', 10);
--   SELECT name, price     FROM search_wines_fuzzy('10902101', 5);
--   SELECT name, price     FROM search_wines_fuzzy('versailles diamant', 5); -- 1224.90, not NULL
--   SELECT name, volume    FROM search_wines_fuzzy('beerenauslese', 10);     -- 37.5, no crash
--   SELECT name            FROM search_wines_fuzzy('gamle tarnhuset', 5);
--   SELECT name            FROM search_wines_fuzzy('nebbiolo', 10);          -- grape match
