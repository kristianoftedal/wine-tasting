-- Add embedding column to wines table for semantic search
ALTER TABLE wines ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- Create index for vector similarity search on wines
CREATE INDEX IF NOT EXISTS idx_wines_embedding ON wines USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create function to generate searchable text from wine data
CREATE OR REPLACE FUNCTION generate_wine_search_text(wine wines)
RETURNS TEXT AS $$
DECLARE
  search_parts TEXT[];
  ingredient JSONB;
  good_for JSONB;
  trait JSONB;
BEGIN
  search_parts := ARRAY[
    wine.name,
    COALESCE(wine.description, ''),
    COALESCE(wine.summary, ''),
    COALESCE(wine.color, ''),
    COALESCE(wine.smell, ''),
    COALESCE(wine.taste, ''),
    COALESCE((wine.main_category->>'name'), ''),
    COALESCE((wine.main_country->>'name'), ''),
    COALESCE((wine.main_producer->>'name'), '')
  ];
  
  -- Add ingredients (grape varieties)
  IF wine.content IS NOT NULL AND wine.content->'ingredients' IS NOT NULL THEN
    FOR ingredient IN SELECT * FROM jsonb_array_elements(wine.content->'ingredients')
    LOOP
      search_parts := array_append(search_parts, ingredient->>'readableValue');
    END LOOP;
  END IF;
  
  -- Add food pairings
  IF wine.content IS NOT NULL AND wine.content->'isGoodFor' IS NOT NULL THEN
    FOR good_for IN SELECT * FROM jsonb_array_elements(wine.content->'isGoodFor')
    LOOP
      search_parts := array_append(search_parts, good_for->>'name');
    END LOOP;
  END IF;
  
  -- Add traits
  IF wine.content IS NOT NULL AND wine.content->'traits' IS NOT NULL THEN
    FOR trait IN SELECT * FROM jsonb_array_elements(wine.content->'traits')
    LOOP
      search_parts := array_append(search_parts, trait->>'readableValue');
    END LOOP;
  END IF;
  
  -- Add style description
  IF wine.content IS NOT NULL AND wine.content->'style'->>'description' IS NOT NULL THEN
    search_parts := array_append(search_parts, wine.content->'style'->>'description');
  END IF;
  
  RETURN array_to_string(search_parts, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update search_text for all wines
UPDATE wines SET search_text = generate_wine_search_text(wines.*);

-- Create function for wine similarity search
CREATE OR REPLACE FUNCTION match_wines(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  name TEXT,
  description TEXT,
  summary TEXT,
  price JSONB,
  main_category JSONB,
  main_country JSONB,
  content JSONB,
  url TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    wines.id,
    wines.product_id,
    wines.name,
    wines.description,
    wines.summary,
    wines.price,
    wines.main_category,
    wines.main_country,
    wines.content,
    wines.url,
    1 - (wines.embedding <=> query_embedding) AS similarity
  FROM wines
  WHERE wines.embedding IS NOT NULL
    AND 1 - (wines.embedding <=> query_embedding) > match_threshold
  ORDER BY wines.embedding <=> query_embedding
  LIMIT match_count;
$$;
