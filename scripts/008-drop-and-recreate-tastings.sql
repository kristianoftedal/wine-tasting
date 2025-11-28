-- Drop the old tastings table and recreate with new schema
DROP TABLE IF EXISTS tastings CASCADE;

-- Create new tastings table with score columns
CREATE TABLE tastings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  
  -- Basic tasting attributes
  farge TEXT,
  smell TEXT, -- Transformed from selectedFlavorsLukt (comma-separated flavor names)
  taste TEXT, -- Transformed from selectedFlavorsSmak (comma-separated flavor names)
  lukt TEXT, -- Additional smell notes
  smak TEXT, -- Additional taste notes
  
  -- Numeric characteristics (1-10 scale)
  friskhet INTEGER CHECK (friskhet BETWEEN 1 AND 10),
  fylde INTEGER CHECK (fylde BETWEEN 1 AND 10),
  sodme INTEGER CHECK (sodme BETWEEN 0 AND 10),
  snaerp INTEGER CHECK (snaerp BETWEEN 0 AND 10),
  karakter INTEGER CHECK (karakter BETWEEN 1 AND 10),
  
  -- Additional attributes
  egenskaper TEXT,
  lukt_intensitet TEXT,
  smaks_intensitet TEXT,
  alkohol TEXT,
  pris DECIMAL,
  
  -- Score columns (0-100 scale for comparison scores)
  color_score INTEGER CHECK (color_score BETWEEN 0 AND 100),
  smell_score INTEGER CHECK (smell_score BETWEEN 0 AND 100),
  taste_score INTEGER CHECK (taste_score BETWEEN 0 AND 100),
  percentage_score INTEGER CHECK (percentage_score BETWEEN 0 AND 100),
  price_score INTEGER CHECK (price_score BETWEEN 0 AND 100),
  snaerp_score INTEGER CHECK (snaerp_score BETWEEN 0 AND 100),
  sodme_score INTEGER CHECK (sodme_score BETWEEN 0 AND 100),
  fylde_score INTEGER CHECK (fylde_score BETWEEN 0 AND 100),
  friskhet_score INTEGER CHECK (friskhet_score BETWEEN 0 AND 100),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  
  -- Timestamps
  tasted_at TIMESTAMP WITH TIME ZONE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tastings_user_id ON tastings(user_id);
CREATE INDEX idx_tastings_product_id ON tastings(product_id);
CREATE INDEX idx_tastings_event_id ON tastings(event_id);
CREATE INDEX idx_tastings_tasted_at ON tastings(tasted_at);

-- Enable Row Level Security
ALTER TABLE tastings ENABLE ROW LEVEL SECURITY;

-- Tastings policies
CREATE POLICY "Users can view own tastings" ON tastings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tastings" ON tastings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tastings" ON tastings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tastings" ON tastings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view tastings in group events" ON tastings 
FOR SELECT USING (
  event_id IS NULL OR
  EXISTS (
    SELECT 1 FROM events e
    INNER JOIN group_members gm ON gm.group_id = e.group_id
    WHERE e.id = tastings.event_id 
    AND gm.user_id = auth.uid()
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tastings;
