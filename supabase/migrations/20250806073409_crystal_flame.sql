/*
  # Restore Working Triagem Schema

  1. Tables
    - users: Basic user information
    - photographers: Photographer profiles
    - events: Photo sessions/events
    - albums: Photo albums
    - photos: Individual photos
    - orders: Photo orders/purchases

  2. Security
    - Enable RLS on all tables
    - Simple policies that work with auth.uid()
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS photographers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text CHECK (role IN ('photographer', 'client')) DEFAULT 'photographer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create photographers table
CREATE TABLE photographers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create events table
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  session_type text DEFAULT 'photo_session',
  event_date timestamptz NOT NULL,
  location text DEFAULT 'Studio',
  notes text,
  status text CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

-- Create albums table
CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE,
  name text NOT NULL,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create photos table
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES albums(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_path text NOT NULL,
  thumbnail_path text NOT NULL,
  watermarked_path text NOT NULL,
  is_selected boolean DEFAULT false,
  price numeric(10,2) DEFAULT 25.00,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  selected_photos text[] DEFAULT '{}',
  total_amount numeric(10,2) DEFAULT 0,
  status text CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')) DEFAULT 'pending',
  payment_intent_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can manage own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- Photographers policies
CREATE POLICY "Photographers can manage own profile" ON photographers
  FOR ALL USING (user_id = auth.uid());

-- Events policies
CREATE POLICY "Photographers can manage own events" ON events
  FOR ALL USING (photographer_id IN (
    SELECT id FROM photographers WHERE user_id = auth.uid()
  ));

-- Albums policies
CREATE POLICY "Photographers can manage own albums" ON albums
  FOR ALL USING (photographer_id IN (
    SELECT id FROM photographers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public can view active albums" ON albums
  FOR SELECT USING (is_active = true);

-- Photos policies
CREATE POLICY "Photographers can manage own photos" ON photos
  FOR ALL USING (album_id IN (
    SELECT a.id FROM albums a
    JOIN photographers p ON a.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Public can view photos in active albums" ON photos
  FOR SELECT USING (album_id IN (
    SELECT id FROM albums WHERE is_active = true
  ));

CREATE POLICY "Public can update photo selection in active albums" ON photos
  FOR UPDATE USING (album_id IN (
    SELECT id FROM albums WHERE is_active = true
  ));

-- Orders policies
CREATE POLICY "Photographers can view own orders" ON orders
  FOR SELECT USING (event_id IN (
    SELECT e.id FROM events e
    JOIN photographers p ON e.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Public can create orders" ON orders
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_photographers_user_id ON photographers(user_id);
CREATE INDEX idx_events_photographer_id ON events(photographer_id);
CREATE INDEX idx_albums_photographer_id ON albums(photographer_id);
CREATE INDEX idx_albums_event_id ON albums(event_id);
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_orders_event_id ON orders(event_id);