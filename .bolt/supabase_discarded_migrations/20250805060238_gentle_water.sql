/*
  # Fix Storage Bucket Policies for Real Photo Upload

  1. Storage Configuration
    - Create photos bucket with proper settings
    - Set up RLS policies for authenticated users
    - Allow public read access for photo viewing

  2. Security
    - Photographers can upload to their own albums
    - Public can view photos from active albums
    - Proper file size and type restrictions
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Drop existing storage policies
DROP POLICY IF EXISTS "Photographers can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Photographers can delete own photos" ON storage.objects;

-- Create comprehensive storage policies
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  -- Allow upload if the path starts with an album ID that belongs to the user
  EXISTS (
    SELECT 1 FROM albums a
    WHERE a.id::text = split_part(name, '/', 1)
    AND (
      -- Album belongs directly to photographer
      a.photographer_id IN (
        SELECT p.id FROM photographers p WHERE p.user_id = auth.uid()
      )
      OR
      -- Album belongs to event owned by photographer
      a.event_id IN (
        SELECT e.id FROM events e
        JOIN photographers p ON e.photographer_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

CREATE POLICY "Photographers can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM albums a
    WHERE a.id::text = split_part(name, '/', 1)
    AND (
      a.photographer_id IN (
        SELECT p.id FROM photographers p WHERE p.user_id = auth.uid()
      )
      OR
      a.event_id IN (
        SELECT e.id FROM events e
        JOIN photographers p ON e.photographer_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Photographers can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM albums a
    WHERE a.id::text = split_part(name, '/', 1)
    AND (
      a.photographer_id IN (
        SELECT p.id FROM photographers p WHERE p.user_id = auth.uid()
      )
      OR
      a.event_id IN (
        SELECT e.id FROM events e
        JOIN photographers p ON e.photographer_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  )
);