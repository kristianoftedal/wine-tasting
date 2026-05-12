-- =============================================================================
-- WINE TASTING — CURRENT DATABASE SCHEMA
-- Consolidated from migrations 001–016
-- Last updated: 2026-05-12
-- =============================================================================

-- EXTENSIONS
-- pg_trgm is enabled by default on Supabase
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;


-- =============================================================================
-- TABLES
-- =============================================================================

-- Extends Supabase auth.users
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  date        TIMESTAMP WITH TIME ZONE NOT NULL,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wines       TEXT[] DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTE: main_category, main_country, main_producer, district, sub_district
-- are stored as TEXT in the live DB (confirmed by btree indexes). The original
-- migrations declared them JSONB but the import stored them as plain text.
-- The search/similarity functions cast defensively via ::text / ::jsonb.
CREATE TABLE wines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              TEXT NOT NULL,
  name                    TEXT NOT NULL,
  description             TEXT,
  summary                 TEXT,
  url                     TEXT,
  year                    TEXT,

  -- Pricing and volume
  price                   JSONB,         -- { value, formattedValue, readableValue }
  volume                  JSONB,         -- { value, formattedValue, readableValue }
  litre_price             JSONB,

  -- Tasting notes (from Vinmonopolet data)
  color                   TEXT,
  smell                   TEXT,
  taste                   TEXT,

  -- Numeric sensory attributes used by find_similar_wines_weighted
  fylde                   NUMERIC,
  friskhet                NUMERIC,
  garvestoff              NUMERIC,
  sodme                   NUMERIC,

  -- Product attributes
  age_limit               INTEGER,
  allergens               TEXT,
  bio_dynamic             BOOLEAN DEFAULT FALSE,
  buyable                 BOOLEAN DEFAULT TRUE,
  cork                    TEXT,
  eco                     BOOLEAN DEFAULT FALSE,
  environmental_packaging BOOLEAN DEFAULT FALSE,
  expired                 BOOLEAN DEFAULT FALSE,
  package_type            TEXT,
  release_mode            BOOLEAN DEFAULT FALSE,
  similar_products        BOOLEAN DEFAULT FALSE,
  status                  TEXT,
  status_notification     BOOLEAN DEFAULT FALSE,
  sustainable             BOOLEAN DEFAULT FALSE,

  -- Distributor
  distributor             TEXT,
  distributor_id          INTEGER,
  whole_saler             TEXT,

  -- Location / category (stored as TEXT in live DB despite original JSONB intent)
  district                TEXT,
  main_country            TEXT,
  main_producer           TEXT,
  sub_district            TEXT,
  main_category           TEXT,

  -- Rich nested content
  content                 JSONB,         -- { characteristics, ingredients, isGoodFor, storagePotential, style, traits }
  is_good_for             JSONB,         -- denormalized from content->'isGoodFor': [{name, code, ...}]

  -- Denormalized style description text extracted from content->>'Description'->Style->Description.
  -- Kept in sync by trigger wines_general_description_sync.
  general_description     TEXT,

  -- Pre-computed search text: name + country + district + producer + category +
  -- grape varieties + food pairings + traits. Kept in sync by trigger.
  search_text             TEXT,

  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique on (product_id, year) — allows multiple vintages of the same product
  UNIQUE (product_id, year)
);

-- Final schema after migration 008 (drop-and-recreate)
CREATE TABLE tastings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL,

  -- Tasting observations
  farge             TEXT,
  smell             TEXT,       -- comma-separated aroma flavour names
  taste             TEXT,       -- comma-separated palate flavour names
  lukt              TEXT,       -- free-text aroma notes
  smak              TEXT,       -- free-text palate notes

  -- Numeric characteristics (1–10 scale)
  friskhet          INTEGER CHECK (friskhet  BETWEEN 1 AND 10),
  fylde             INTEGER CHECK (fylde     BETWEEN 1 AND 10),
  sodme             INTEGER CHECK (sodme     BETWEEN 0 AND 10),
  garvestoffer            INTEGER CHECK (garvestoffer    BETWEEN 0 AND 10),
  karakter          INTEGER CHECK (karakter  BETWEEN 1 AND 10),

  -- Extra attributes
  egenskaper        TEXT,
  lukt_intensitet   TEXT,
  smaks_intensitet  TEXT,
  alkohol           TEXT,
  pris              DECIMAL,

  -- Computed comparison scores (0–100)
  color_score       INTEGER CHECK (color_score       BETWEEN 0 AND 100),
  smell_score       INTEGER CHECK (smell_score       BETWEEN 0 AND 100),
  taste_score       INTEGER CHECK (taste_score       BETWEEN 0 AND 100),
  percentage_score  INTEGER CHECK (percentage_score  BETWEEN 0 AND 100),
  price_score       INTEGER CHECK (price_score       BETWEEN 0 AND 100),
  garvestoffer_score      INTEGER CHECK (garvestoffer_score      BETWEEN 0 AND 100),
  sodme_score       INTEGER CHECK (sodme_score       BETWEEN 0 AND 100),
  fylde_score       INTEGER CHECK (fylde_score       BETWEEN 0 AND 100),
  friskhet_score    INTEGER CHECK (friskhet_score    BETWEEN 0 AND 100),
  overall_score     INTEGER CHECK (overall_score     BETWEEN 0 AND 100),

  tasted_at  TIMESTAMP WITH TIME ZONE,
  event_id   UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE wine_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  summary       TEXT,
  category      TEXT,
  food_tags     TEXT[] DEFAULT '{}',   -- e.g. ['Pizza og pasta', 'Fisk']
  occasion_tags TEXT[] DEFAULT '{}',   -- e.g. ['Julemat', 'Asiatisk mat']
  embedding     VECTOR(1536),
  scraped_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =============================================================================
-- INDEXES
-- =============================================================================

-- group_members
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id  ON group_members(user_id);

-- events
CREATE INDEX idx_events_group_id ON events(group_id);

-- wines
-- (product_id, year) uniqueness is enforced by the table constraint above
CREATE INDEX idx_wines_name_trgm     ON wines USING GIN (name gin_trgm_ops); -- powers search_wines_fuzzy
CREATE INDEX idx_wines_name_ccnew    ON wines(name);
CREATE INDEX idx_wines_main_category ON wines(main_category);  -- btree; main_category is TEXT in live DB
CREATE INDEX idx_wines_friskhet      ON wines(friskhet)   WHERE friskhet   IS NOT NULL;
CREATE INDEX idx_wines_fylde         ON wines(fylde)      WHERE fylde      IS NOT NULL;
CREATE INDEX idx_wines_garvestoff    ON wines(garvestoff) WHERE garvestoff IS NOT NULL;
CREATE INDEX idx_wines_sodme         ON wines(sodme)      WHERE sodme      IS NOT NULL;
CREATE INDEX idx_wines_search_text_trgm ON wines USING GIN (search_text gin_trgm_ops);
CREATE INDEX idx_wines_isgoodfor        ON wines USING GIN (is_good_for);

-- tastings
CREATE INDEX idx_tastings_user_id    ON tastings(user_id);
CREATE INDEX idx_tastings_product_id ON tastings(product_id);
CREATE INDEX idx_tastings_event_id   ON tastings(event_id);
CREATE INDEX idx_tastings_tasted_at  ON tastings(tasted_at);

-- wine_articles
CREATE INDEX idx_wine_articles_embedding     ON wine_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_wine_articles_category      ON wine_articles(category);
CREATE INDEX idx_wine_articles_url           ON wine_articles(url);
CREATE INDEX idx_wine_articles_food_tags     ON wine_articles USING GIN (food_tags);
CREATE INDEX idx_wine_articles_occasion_tags ON wine_articles USING GIN (occasion_tags);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tastings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_articles ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view all profiles"  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- groups
CREATE POLICY "Anyone can view groups"             ON groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group members can update groups"    ON groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = id AND group_members.user_id = auth.uid())
);

-- group_members
CREATE POLICY "Anyone can view group members"       ON group_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups"              ON group_members FOR DELETE USING (auth.uid() = user_id);

-- events
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Group members can create events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = events.group_id AND group_members.user_id = auth.uid())
);
CREATE POLICY "Group members can update events" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = events.group_id AND group_members.user_id = auth.uid())
);

-- wines (public read, authenticated write)
CREATE POLICY "Anyone can view wines"            ON wines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add wines" ON wines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update wines" ON wines FOR UPDATE USING (auth.uid() IS NOT NULL);

-- tastings
CREATE POLICY "Users can view own tastings"   ON tastings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tastings" ON tastings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tastings" ON tastings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tastings" ON tastings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view tastings in group events" ON tastings FOR SELECT USING (
  event_id IS NULL OR
  EXISTS (
    SELECT 1 FROM events e
    INNER JOIN group_members gm ON gm.group_id = e.group_id
    WHERE e.id = tastings.event_id AND gm.user_id = auth.uid()
  )
);

-- wine_articles
CREATE POLICY "Anyone can view articles"            ON wine_articles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add articles" ON wine_articles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Maintain updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Keeps search_text in sync whenever searchable wine fields are updated
CREATE OR REPLACE FUNCTION wines_update_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := generate_wine_search_text(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wines_search_text_sync
  BEFORE INSERT OR UPDATE OF name, description, summary, color, smell, taste,
    main_category, main_country, main_producer, content
  ON wines
  FOR EACH ROW EXECUTE FUNCTION wines_update_search_text();

-- Build search_text from all relevant wine fields (used to populate the column).
-- Location/category fields handled defensively for TEXT or JSONB storage.
-- Does NOT reference description/summary/color/smell/taste — those columns do
-- not exist on the imported wines table in the live DB.
CREATE OR REPLACE FUNCTION generate_wine_search_text(wine wines)
RETURNS TEXT AS $$
DECLARE
  search_parts  TEXT[];
  mc_name       TEXT;
  country_name  TEXT;
  producer_name TEXT;
  district_name TEXT;
  ingredient    JSONB;
  good_for      JSONB;
  trait         JSONB;
BEGIN
  mc_name := CASE
    WHEN (wine.main_category::text) LIKE '{%' THEN (wine.main_category::text)::jsonb->>'name'
    ELSE wine.main_category::text
  END;
  country_name := CASE
    WHEN (wine.main_country::text) LIKE '{%' THEN (wine.main_country::text)::jsonb->>'name'
    ELSE wine.main_country::text
  END;
  producer_name := CASE
    WHEN (wine.main_producer::text) LIKE '{%' THEN (wine.main_producer::text)::jsonb->>'name'
    ELSE wine.main_producer::text
  END;
  district_name := CASE
    WHEN (wine.district::text) LIKE '{%' THEN (wine.district::text)::jsonb->>'name'
    ELSE wine.district::text
  END;

  search_parts := ARRAY[
    wine.name,
    COALESCE(mc_name, ''),
    COALESCE(country_name, ''),
    COALESCE(producer_name, ''),
    COALESCE(district_name, '')
  ];

  IF wine.content IS NOT NULL AND wine.content->'ingredients' IS NOT NULL THEN
    FOR ingredient IN SELECT * FROM jsonb_array_elements(wine.content->'ingredients')
    LOOP
      search_parts := array_append(search_parts, COALESCE(ingredient->>'readableValue', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'isGoodFor' IS NOT NULL THEN
    FOR good_for IN SELECT * FROM jsonb_array_elements(wine.content->'isGoodFor')
    LOOP
      search_parts := array_append(search_parts, COALESCE(good_for->>'name', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'traits' IS NOT NULL THEN
    FOR trait IN SELECT * FROM jsonb_array_elements(wine.content->'traits')
    LOOP
      search_parts := array_append(search_parts, COALESCE(trait->>'readableValue', ''));
    END LOOP;
  END IF;

  IF wine.content IS NOT NULL AND wine.content->'style'->>'description' IS NOT NULL THEN
    search_parts := array_append(search_parts, wine.content->'style'->>'description');
  END IF;

  RETURN array_to_string(search_parts, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Semantic search on wines via cosine similarity over OpenAI embeddings
CREATE OR REPLACE FUNCTION match_wines(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  id            UUID,
  product_id    TEXT,
  name          TEXT,
  description   TEXT,
  summary       TEXT,
  price         JSONB,
  main_category JSONB,
  main_country  JSONB,
  content       JSONB,
  url           TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    w.id,
    w.product_id,
    w.name,
    w.description,
    w.summary,
    w.price,
    w.main_category,
    w.main_country,
    w.content,
    w.url,
    1 - (w.embedding <=> query_embedding) AS similarity
  FROM wines w
  WHERE w.embedding IS NOT NULL
    AND 1 - (w.embedding <=> query_embedding) > match_threshold
  ORDER BY w.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Semantic search on wine articles via cosine similarity
CREATE OR REPLACE FUNCTION match_wine_articles(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  id         UUID,
  url        TEXT,
  title      TEXT,
  content    TEXT,
  summary    TEXT,
  category   TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    a.id,
    a.url,
    a.title,
    a.content,
    a.summary,
    a.category,
    1 - (a.embedding <=> query_embedding) AS similarity
  FROM wine_articles a
  WHERE 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Type-ahead search across name, country, district, producer, category, grape
-- varieties, and food pairings via the pre-computed search_text column.
-- word_similarity is used so a short query matches as a word within the longer
-- search_text. Name matches are weighted higher (1.0 vs 0.7).
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
LANGUAGE SQL STABLE
AS $$
  SELECT
    w.id,
    w.product_id,
    w.name,
    w.year,
    CASE
      WHEN (w.volume::text) LIKE '{%' THEN ((w.volume::text)::jsonb->>'value')::numeric
      WHEN w.volume IS NOT NULL        THEN split_part(w.volume::text, ' ', 1)::numeric
      ELSE NULL
    END,
    CASE
      WHEN (w.main_category::text) LIKE '{%' THEN (w.main_category::text)::jsonb->>'name'
      ELSE w.main_category::text
    END,
    CASE
      WHEN (w.main_country::text) LIKE '{%' THEN (w.main_country::text)::jsonb->>'name'
      ELSE w.main_country::text
    END,
    CASE
      WHEN (w.district::text) LIKE '{%' THEN (w.district::text)::jsonb->>'name'
      ELSE w.district::text
    END,
    CASE
      WHEN (w.price::text) LIKE '{%' THEN ((w.price::text)::jsonb->>'value')::numeric
      WHEN w.price IS NOT NULL         THEN replace(split_part(w.price::text, ' ', 2), ',', '.')::numeric
      ELSE NULL
    END,
    GREATEST(
      similarity(w.name, search_query),
      word_similarity(search_query, w.search_text) * 0.7
    )::float AS similarity
  FROM wines w
  WHERE
    w.name % search_query
    OR search_query <% w.search_text
    OR w.name ILIKE '%' || search_query || '%'
  ORDER BY GREATEST(
    similarity(w.name, search_query),
    word_similarity(search_query, w.search_text) * 0.7
  ) DESC
  LIMIT result_limit;
$$;

-- Returns wines whose isGoodFor list contains a food matching the query string.
-- Exact containment uses the GIN index; ILIKE catches partial matches
-- (e.g. "pasta" matches the label "Pizza og pasta").
CREATE OR REPLACE FUNCTION search_wines_by_food(
  food_query   TEXT,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id            UUID,
  product_id    TEXT,
  name          TEXT,
  year          TEXT,
  main_category TEXT,
  main_country  TEXT,
  district      TEXT,
  price         NUMERIC,
  food_match    TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT DISTINCT ON (w.id)
    w.id,
    w.product_id,
    w.name,
    w.year,
    CASE
      WHEN (w.main_category::text) LIKE '{%' THEN (w.main_category::text)::jsonb->>'name'
      ELSE w.main_category::text
    END,
    CASE
      WHEN (w.main_country::text) LIKE '{%' THEN (w.main_country::text)::jsonb->>'name'
      ELSE w.main_country::text
    END,
    CASE
      WHEN (w.district::text) LIKE '{%' THEN (w.district::text)::jsonb->>'name'
      ELSE w.district::text
    END,
    CASE
      WHEN (w.price::text) LIKE '{%' THEN ((w.price::text)::jsonb->>'value')::numeric
      WHEN w.price IS NOT NULL THEN replace(split_part(w.price::text, ' ', 2), ',', '.')::numeric
      ELSE NULL
    END,
    elem->>'name' AS food_match
  FROM wines w,
    jsonb_array_elements(w.content->'isGoodFor') AS elem
  WHERE
    w.content IS NOT NULL
    AND w.content->'isGoodFor' IS NOT NULL
    AND elem->>'name' ILIKE '%' || food_query || '%'
  ORDER BY w.id, w.name
  LIMIT result_limit;
$$;

-- Candidate retrieval for JS-side similarity ranking.
-- Returns wines whose sensory profile (body/acidity/tannin/sweetness) is closest
-- to the reference wine, excluding wines already seen. JS re-ranks the candidates
-- using semantic embeddings and per-component weighted scoring.
CREATE OR REPLACE FUNCTION find_similar_wines_weighted(
  p_fylde            NUMERIC,
  p_friskhet         NUMERIC,
  p_garvestoff       NUMERIC,
  p_sodme            NUMERIC,
  p_excluded_wine_ids UUID[],
  p_main_category    TEXT,
  p_limit            INT
)
RETURNS SETOF wines
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT w.*
  FROM wines w
  WHERE
    (p_main_category IS NULL OR w.main_category = p_main_category)
    AND (p_excluded_wine_ids IS NULL OR NOT (w.id = ANY(p_excluded_wine_ids)))
  ORDER BY
    (
      COALESCE(1.0 - ABS(w.fylde      - p_fylde)      / 12.0, 0) +
      COALESCE(1.0 - ABS(w.friskhet   - p_friskhet)   / 12.0, 0) +
      COALESCE(1.0 - ABS(w.garvestoff - p_garvestoff) / 12.0, 0) +
      COALESCE(1.0 - ABS(w.sodme      - p_sodme)      / 12.0, 0)
    ) DESC
  LIMIT p_limit;
END;
$$;


-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tastings;
