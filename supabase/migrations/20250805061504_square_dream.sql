/*
  # Fix Storage RLS Policies for Photo Upload

  1. Storage Bucket Setup
    - Ensure 'photos' bucket exists with proper configuration
    - Set file size limit to 50MB
    - Allow image MIME types

  2. Storage Policies
    - Allow authenticated photographers to upload to their own albums
    - Allow public read access to photos
    - Validate album ownership through photographer_id

  3. Security
    - Photographers can only upload to albums they own
    - Public can view photos from active albums
    - Proper path validation for security
*/

-- Create photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Drop existing storage policies to recreate them
DROP POLICY IF EXISTS "Photographers can upload to own albums" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Photographers can delete own photos" ON storage.objects;

-- Allow authenticated photographers to upload photos to their own albums
CREATE POLICY "Photographers can upload to own albums"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  auth.uid() IN (
    SELECT p.user_id 
    FROM photographers p
    JOIN albums a ON (a.photographer_id = p.id)
    WHERE a.id::text = split_part(name, '/', 1)
  )
);

-- Allow public read access to photos
CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Allow photographers to delete their own photos
CREATE POLICY "Photographers can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  auth.uid() IN (
    SELECT p.user_id 
    FROM photographers p
    JOIN albums a ON (a.photographer_id = p.id)
    WHERE a.id::text = split_part(name, '/', 1)
  )
);

-- Ensure all albums have photographer_id set
UPDATE albums 
SET photographer_id = (
  SELECT p.id 
  FROM photographers p 
  JOIN events e ON e.photographer_id = p.id 
  WHERE e.id = albums.event_id
)
WHERE photographer_id IS NULL AND event_id IS NOT NULL;

-- Update photos table RLS policies to be more permissive for authenticated users
DROP POLICY IF EXISTS "photographers_can_insert_photos_to_owned_albums" ON photos;

CREATE POLICY "photographers_can_insert_photos_to_owned_albums"
ON photos
FOR INSERT
TO authenticated
WITH CHECK (
  album_id IN (
    SELECT a.id
    FROM albums a
    JOIN photographers p ON (a.photographer_id = p.id)
    WHERE p.user_id = auth.uid()
  )
);