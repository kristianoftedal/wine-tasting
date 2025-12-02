-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create articles table for Vinmonopolet content
CREATE TABLE wine_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  -- Vector embedding for semantic search (OpenAI embeddings are 1536 dimensions)
  embedding VECTOR(1536),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON wine_articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create index for efficient lookups
CREATE INDEX idx_wine_articles_category ON wine_articles(category);
CREATE INDEX idx_wine_articles_url ON wine_articles(url);

-- Enable Row Level Security
ALTER TABLE wine_articles ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view articles" ON wine_articles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add articles" ON wine_articles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
