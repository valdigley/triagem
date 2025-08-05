/*
  # Fix Storage Bucket RLS Policies for Photo Uploads

  1. Storage Bucket Setup
    - Create 'photos' bucket if it doesn't exist
    - Configure bucket settings for public access
    
  2. Storage Policies
    - Allow authenticated photographers to upload photos to their own albums
    - Allow public read access to photos in active albums
    - Allow photographers to delete their own photos
    
  3. Security
    - Policies ensure photographers can only upload to albums of their own events
    - Public can only view photos from active albums
*/

-- Create photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Photographers can upload photos to own albums" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos in active albums" ON storage.objects;
DROP POLICY IF EXISTS "Photographers can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read photos" ON storage.objects;

-- Create storage policies for photos bucket
CREATE POLICY "Photographers can upload photos to own albums"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text
    FROM albums a
    JOIN events e ON a.event_id = e.id
    JOIN photographers p ON e.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view photos in active albums"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text
    FROM albums a
    WHERE a.is_active = true
  )
);

CREATE POLICY "Photographers can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text
    FROM albums a
    JOIN events e ON a.event_id = e.id
    JOIN photographers p ON e.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Photographers can update own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text
    FROM albums a
    JOIN events e ON a.event_id = e.id
    JOIN photographers p ON e.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text
    FROM albums a
    JOIN events e ON a.event_id = e.id
    JOIN photographers p ON e.photographer_id = p.id
    WHERE p.user_id = auth.uid()
  )
);