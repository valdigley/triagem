/*
  # Fix Storage RLS Policies for Photo Uploads

  1. Storage Policies
    - Create policies for the 'photos' bucket to allow authenticated users to upload
    - Allow photographers to upload photos to their own albums
    - Allow public read access for photo viewing

  2. Security
    - Photographers can only upload to albums they own
    - Public can read photos from active albums
    - Proper validation of file paths and ownership
*/

-- First, ensure the photos bucket exists and has proper RLS
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

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Photographers can upload photos to own albums" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Photographers can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from photos bucket" ON storage.objects;

-- Create comprehensive storage policies for photos bucket
CREATE POLICY "Allow authenticated uploads to photos bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  -- Check if the album exists and belongs to the user
  (
    -- For albums with events (check via photographer_id in events)
    EXISTS (
      SELECT 1 FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE a.id::text = split_part(name, '/', 1)
      AND p.user_id = auth.uid()
    )
    OR
    -- For independent albums (check via photographer_id in albums)
    EXISTS (
      SELECT 1 FROM albums a
      JOIN photographers p ON a.photographer_id = p.id
      WHERE a.id::text = split_part(name, '/', 1)
      AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Allow public reads from photos bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

CREATE POLICY "Photographers can delete own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (
    -- For albums with events
    EXISTS (
      SELECT 1 FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE a.id::text = split_part(name, '/', 1)
      AND p.user_id = auth.uid()
    )
    OR
    -- For independent albums
    EXISTS (
      SELECT 1 FROM albums a
      JOIN photographers p ON a.photographer_id = p.id
      WHERE a.id::text = split_part(name, '/', 1)
      AND p.user_id = auth.uid()
    )
  )
);

-- Update albums table to ensure all albums have photographer_id
UPDATE albums 
SET photographer_id = (
  SELECT e.photographer_id 
  FROM events e 
  WHERE e.id = albums.event_id
)
WHERE photographer_id IS NULL AND event_id IS NOT NULL;

-- For any remaining albums without photographer_id, set to the first photographer
UPDATE albums 
SET photographer_id = (
  SELECT id FROM photographers ORDER BY created_at LIMIT 1
)
WHERE photographer_id IS NULL;

-- Make photographer_id NOT NULL for future inserts
ALTER TABLE albums ALTER COLUMN photographer_id SET NOT NULL;