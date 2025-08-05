/*
  # Fix RLS policies for photo uploads

  1. Storage Policies
    - Allow authenticated users to upload photos to their albums
    - Support both event-linked and independent albums
  
  2. Database Policies  
    - Allow photographers to insert photos into their own albums
    - Support albums with and without events
    
  3. Security
    - Maintain data isolation between photographers
    - Ensure users can only upload to their own albums
*/

-- First, ensure storage bucket exists and has proper policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Remove existing storage policies that might be conflicting
DROP POLICY IF EXISTS "Allow authenticated users to upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow photographers to upload photos" ON storage.objects;

-- Create comprehensive storage policies
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (
    -- For albums with events: check if user owns the photographer profile
    EXISTS (
      SELECT 1 FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE a.id::text = split_part(name, '/', 1)
      AND p.user_id = auth.uid()
    )
    OR
    -- For independent albums: check if user owns the photographer profile
    EXISTS (
      SELECT 1 FROM albums a
      JOIN photographers p ON true
      WHERE a.id::text = split_part(name, '/', 1)
      AND a.event_id IS NULL
      AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Allow public read access to photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Update photos table policies to handle independent albums
DROP POLICY IF EXISTS "Photographers can manage photos of own albums" ON photos;

CREATE POLICY "Photographers can manage photos of own albums"
ON photos
FOR ALL
TO authenticated
USING (
  -- For albums with events
  (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- For independent albums
  (
    album_id IN (
      SELECT a.id
      FROM albums a
      WHERE a.event_id IS NULL
      AND EXISTS (
        SELECT 1 FROM photographers p
        WHERE p.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  -- Same conditions for INSERT/UPDATE
  (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  (
    album_id IN (
      SELECT a.id
      FROM albums a
      WHERE a.event_id IS NULL
      AND EXISTS (
        SELECT 1 FROM photographers p
        WHERE p.user_id = auth.uid()
      )
    )
  )
);

-- Update albums policies to properly handle independent albums
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_insert_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;

CREATE POLICY "photographers_can_select_own_albums"
ON albums
FOR SELECT
TO authenticated
USING (
  -- For albums with events
  (
    event_id IS NOT NULL AND
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- For independent albums
  (
    event_id IS NULL AND
    EXISTS (
      SELECT 1 FROM photographers p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "photographers_can_insert_albums"
ON albums
FOR INSERT
TO authenticated
WITH CHECK (
  -- For albums with events
  (
    event_id IS NOT NULL AND
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- For independent albums
  (
    event_id IS NULL AND
    EXISTS (
      SELECT 1 FROM photographers p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "photographers_can_update_own_albums"
ON albums
FOR UPDATE
TO authenticated
USING (
  -- For albums with events
  (
    event_id IS NOT NULL AND
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- For independent albums
  (
    event_id IS NULL AND
    EXISTS (
      SELECT 1 FROM photographers p
      WHERE p.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Same conditions for updates
  (
    event_id IS NOT NULL AND
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  (
    event_id IS NULL AND
    EXISTS (
      SELECT 1 FROM photographers p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "photographers_can_delete_own_albums"
ON albums
FOR DELETE
TO authenticated
USING (
  -- For albums with events
  (
    event_id IS NOT NULL AND
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- For independent albums
  (
    event_id IS NULL AND
    EXISTS (
      SELECT 1 FROM photographers p
      WHERE p.user_id = auth.uid()
    )
  )
);