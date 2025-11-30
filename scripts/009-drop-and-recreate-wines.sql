-- Drop the old wines table
DROP TABLE IF EXISTS wines CASCADE;

-- Create new wines table based on MongoDB data model
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core product info
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  url TEXT,
  year TEXT,
  
  -- Pricing and volume
  price JSONB, -- { value: number, formattedValue: string, readableValue: string }
  volume JSONB, -- { value: number, formattedValue: string, readableValue: string }
  litre_price JSONB, -- { value: number, formattedValue: string, readableValue: string }
  
  -- Tasting notes
  color TEXT,
  smell TEXT,
  taste TEXT,
  
  -- Product attributes
  age_limit INTEGER,
  allergens TEXT,
  bio_dynamic BOOLEAN DEFAULT FALSE,
  buyable BOOLEAN DEFAULT TRUE,
  cork TEXT,
  eco BOOLEAN DEFAULT FALSE,
  environmental_packaging BOOLEAN DEFAULT FALSE,
  expired BOOLEAN DEFAULT FALSE,
  package_type TEXT,
  release_mode BOOLEAN DEFAULT FALSE,
  similar_products BOOLEAN DEFAULT FALSE,
  status TEXT,
  status_notification BOOLEAN DEFAULT FALSE,
  sustainable BOOLEAN DEFAULT FALSE,
  
  -- Distributor info
  distributor TEXT,
  distributor_id INTEGER,
  whole_saler TEXT,
  
  -- Location data (JSONB objects with code, name, searchQuery, url)
  district JSONB,
  main_country JSONB,
  main_producer JSONB,
  sub_district JSONB,
  
  -- Category
  main_category JSONB, -- { code: string, name: string }
  
  -- Complex nested content
  content JSONB, -- { characteristics: [], ingredients: [], isGoodFor: [], storagePotential: {}, style: {}, traits: [] }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_wines_code ON wines(code);
CREATE INDEX idx_wines_name ON wines(name);
CREATE INDEX idx_wines_main_category ON wines USING GIN (main_category);
CREATE INDEX idx_wines_content ON wines USING GIN (content);

-- Enable Row Level Security
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;

-- Wines policies (public read access)
CREATE POLICY "Anyone can view wines" ON wines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add wines" ON wines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update wines" ON wines FOR UPDATE USING (auth.uid() IS NOT NULL);
