-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_wine_articles(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    wine_articles.id,
    wine_articles.url,
    wine_articles.title,
    wine_articles.content,
    wine_articles.summary,
    wine_articles.category,
    1 - (wine_articles.embedding <=> query_embedding) AS similarity
  FROM wine_articles
  WHERE 1 - (wine_articles.embedding <=> query_embedding) > match_threshold
  ORDER BY wine_articles.embedding <=> query_embedding
  LIMIT match_count;
$$;
