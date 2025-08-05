/*
  # Rebuild Photo Selection System - Simple and Working

  1. Clean RLS Policies
    - Remove complex policies that are causing issues
    - Create simple, working policies for photo selection
    
  2. Ensure Proper Album Structure
    - Albums can be independent or linked to events
    - Simple ownership model
    
  3. Photo Upload and Selection
    - Photographers can upload photos to their albums
    - Clients can select photos from active albums
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "photographers_can_insert_photos_to_owned_albums" ON photos;
DROP POLICY IF EXISTS "photographers_can_read_own_photos" ON photos;
DROP POLICY IF EXISTS "photographers_can_update_own_photos" ON photos;
DROP POLICY IF EXISTS "photographers_can_delete_own_photos" ON photos;
DROP POLICY IF EXISTS "public_can_read_active_album_photos" ON photos;
DROP POLICY IF EXISTS "public_can_update_photo_selection" ON photos;

-- Drop existing album policies that might be problematic
DROP POLICY IF EXISTS "photographers_can_insert_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;
DROP POLICY IF EXISTS "public_can_read_active_albums" ON albums;
DROP POLICY IF EXISTS "public_can_select_active_albums" ON albums;

-- Ensure albums table has photographer_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'albums' AND column_name = 'photographer_id'
  ) THEN
    ALTER TABLE albums ADD COLUMN photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing albums to have photographer_id
UPDATE albums 
SET photographer_id = (
  SELECT e.photographer_id 
  FROM events e 
  WHERE e.id = albums.event_id
)
WHERE event_id IS NOT NULL AND photographer_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_albums_photographer_id_new ON albums(photographer_id);

-- Simple and working RLS policies for albums
CREATE POLICY "photographers_can_manage_albums"
  ON albums
  FOR ALL
  TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT id FROM events WHERE photographer_id IN (
        SELECT id FROM photographers WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT id FROM events WHERE photographer_id IN (
        SELECT id FROM photographers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "public_can_read_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Simple and working RLS policies for photos
CREATE POLICY "photographers_can_manage_photos"
  ON photos
  FOR ALL
  TO authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE 
        photographer_id IN (
          SELECT id FROM photographers WHERE user_id = auth.uid()
        )
        OR
        event_id IN (
          SELECT id FROM events WHERE photographer_id IN (
            SELECT id FROM photographers WHERE user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT id FROM albums WHERE 
        photographer_id IN (
          SELECT id FROM photographers WHERE user_id = auth.uid()
        )
        OR
        event_id IN (
          SELECT id FROM events WHERE photographer_id IN (
            SELECT id FROM photographers WHERE user_id = auth.uid()
          )
        )
    )
  );

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

-- Simple storage policies
CREATE POLICY IF NOT EXISTS "photographers_can_upload_photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos' AND
    auth.uid() IN (
      SELECT user_id FROM photographers
    )
  );

CREATE POLICY IF NOT EXISTS "photographers_can_read_photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'photos' AND
    auth.uid() IN (
      SELECT user_id FROM photographers
    )
  );

CREATE POLICY IF NOT EXISTS "public_can_read_photos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'photos');

CREATE POLICY IF NOT EXISTS "photographers_can_delete_photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'photos' AND
    auth.uid() IN (
      SELECT user_id FROM photographers
    )
  );