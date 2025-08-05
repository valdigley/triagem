/*
  # Fix photos table RLS policy for uploads

  1. Security Changes
    - Update INSERT policy on `photos` table to allow photographers to upload photos to their own albums
    - Ensure photographers can only insert photos into albums that belong to their events

  2. Policy Details
    - Policy allows INSERT operations for authenticated users
    - Validates that the album belongs to an event owned by the current photographer
    - Maintains security by preventing cross-photographer photo uploads
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Photographers can manage photos of own albums" ON photos;

-- Create new INSERT policy for photos
CREATE POLICY "Photographers can insert photos to own albums"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create separate SELECT policy
CREATE POLICY "Photographers can view photos of own albums"
  ON photos
  FOR SELECT
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create UPDATE policy for photo selection
CREATE POLICY "Photographers can update photos of own albums"
  ON photos
  FOR UPDATE
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create DELETE policy
CREATE POLICY "Photographers can delete photos of own albums"
  ON photos
  FOR DELETE
  TO authenticated
  USING (
    album_id IN (
      SELECT a.id
      FROM albums a
      JOIN events e ON a.event_id = e.id
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Keep the existing public policies for album sharing
CREATE POLICY "Public can read photos of active albums"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

CREATE POLICY "Public can update photo selection in active albums"
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