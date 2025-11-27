-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members junction table for many-to-many relationship
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create wines table with JSONB for complex nested data
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  color TEXT,
  smell TEXT,
  taste TEXT,
  year TEXT,
  price JSONB,
  volume JSONB,
  litre_price JSONB,
  age_limit INTEGER,
  allergens TEXT,
  bio_dynamic BOOLEAN DEFAULT FALSE,
  buyable BOOLEAN DEFAULT TRUE,
  cork TEXT,
  distributor TEXT,
  distributor_id INTEGER,
  district JSONB,
  eco BOOLEAN DEFAULT FALSE,
  environmental_packaging BOOLEAN DEFAULT FALSE,
  expired BOOLEAN DEFAULT FALSE,
  main_category JSONB,
  main_country JSONB,
  main_producer JSONB,
  sub_district JSONB,
  package_type TEXT,
  release_mode BOOLEAN DEFAULT FALSE,
  similar_products BOOLEAN DEFAULT FALSE,
  status TEXT,
  status_notification BOOLEAN DEFAULT FALSE,
  sustainable BOOLEAN DEFAULT FALSE,
  url TEXT,
  whole_saler TEXT,
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wines TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tastings table
CREATE TABLE tastings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  farge TEXT,
  lukt TEXT,
  smak TEXT,
  friskhet INTEGER,
  fylde INTEGER,
  sodme INTEGER,
  snaerp INTEGER,
  karakter INTEGER,
  egenskaper TEXT,
  selected_flavors_lukt JSONB DEFAULT '[]',
  selected_flavors_smak JSONB DEFAULT '[]',
  lukt_intensitet TEXT,
  smaks_intensitet TEXT,
  alkohol TEXT,
  pris DECIMAL,
  tasted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_events_group_id ON events(group_id);
CREATE INDEX idx_tastings_user_id ON tastings(user_id);
CREATE INDEX idx_tastings_product_id ON tastings(product_id);
CREATE INDEX idx_wines_code ON wines(code);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tastings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups policies (anyone can view groups, members can modify)
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Group members can update groups" ON groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = id AND group_members.user_id = auth.uid())
);

-- Group members policies
CREATE POLICY "Anyone can view group members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- Wines policies (public read access)
CREATE POLICY "Anyone can view wines" ON wines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add wines" ON wines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Events policies
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Group members can create events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = events.group_id AND group_members.user_id = auth.uid())
);
CREATE POLICY "Group members can update events" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = events.group_id AND group_members.user_id = auth.uid())
);

-- Tastings policies
CREATE POLICY "Users can view own tastings" ON tastings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tastings" ON tastings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tastings" ON tastings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tastings" ON tastings FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically create profile on signup
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

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
