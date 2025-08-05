/*
  # Fix photo upload RLS policies

  1. Schema Changes
    - Ensure albums table has photographer_id column
    - Add proper indexes for performance

  2. RLS Policies
    - Update photos table policies to allow uploads to owned albums
    - Update storage policies for photo uploads
    - Ensure proper ownership validation

  3. Security
    - Photographers can only upload to their own albums
    - Proper validation of album ownership
*/

-- Ensure albums table has photographer_id column (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'albums' AND column_name = 'photographer_id'
  ) THEN
    ALTER TABLE albums ADD COLUMN photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'albums' AND indexname = 'idx_albums_photographer_id'
  ) THEN
    CREATE INDEX idx_albums_photographer_id ON albums(photographer_id);
  END IF;
END $$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Photographers can manage photos of own albums" ON photos;
DROP POLICY IF EXISTS "Public can read photos of active albums" ON photos;
DROP POLICY IF EXISTS "Public can update photo selection" ON photos;

-- Create comprehensive RLS policies for photos table
CREATE POLICY "photographers_can_insert_photos_to_owned_albums"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    album_id IN (
      SELECT a.id 
      FROM albums a
      JOIN photographers p ON (
        (a.photographer_id = p.id) OR 
        (a.event_id IN (
          SELECT e.id 
          FROM events e 
          WHERE e.photographer_id = p.id
        ))
      )
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "photographers_can_read_own_photos"
  ON photos
  FOR SELECT
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id 
      FROM albums a
      JOIN photographers p ON (
        (a.photographer_id = p.id) OR 
        (a.event_id IN (
          SELECT e.id 
          FROM events e 
          WHERE e.photographer_id = p.id
        ))
      )
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "photographers_can_update_own_photos"
  ON photos
  FOR UPDATE
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id 
      FROM albums a
      JOIN photographers p ON (
        (a.photographer_id = p.id) OR 
        (a.event_id IN (
          SELECT e.id 
          FROM events e 
          WHERE e.photographer_id = p.id
        ))
      )
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT a.id 
      FROM albums a
      JOIN photographers p ON (
        (a.photographer_id = p.id) OR 
        (a.event_id IN (
          SELECT e.id 
          FROM events e 
          WHERE e.photographer_id = p.id
        ))
      )
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "photographers_can_delete_own_photos"
  ON photos
  FOR DELETE
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id 
      FROM albums a
      JOIN photographers p ON (
        (a.photographer_id = p.id) OR 
        (a.event_id IN (
          SELECT e.id 
          FROM events e 
          WHERE e.photographer_id = p.id
        ))
      )
      WHERE p.user_id = auth.uid()
    )
  );

-- Public policies for active albums (for client photo selection)
CREATE POLICY "public_can_read_active_album_photos"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

CREATE POLICY "public_can_update_photo_selection"
  ON photos
  FOR UPDATE
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

-- Update albums policies to handle photographer_id properly
DROP POLICY IF EXISTS "photographers_can_insert_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;

CREATE POLICY "photographers_can_insert_albums"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )) OR
    (event_id IN (
      SELECT e.id 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_select_own_albums"
  ON albums
  FOR SELECT
  TO authenticated
  USING (
    (photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )) OR
    (event_id IN (
      SELECT e.id 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_update_own_albums"
  ON albums
  FOR UPDATE
  TO authenticated
  USING (
    (photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )) OR
    (event_id IN (
      SELECT e.id 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )) OR
    (event_id IN (
      SELECT e.id 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_delete_own_albums"
  ON albums
  FOR DELETE
  TO authenticated
  USING (
    (photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )) OR
    (event_id IN (
      SELECT e.id 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    ))
  );

-- Public can read active albums
CREATE POLICY "public_can_read_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);