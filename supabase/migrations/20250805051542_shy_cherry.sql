/*
  # Fix albums table RLS policy for INSERT operations

  1. Security Changes
    - Temporarily disable RLS on albums table
    - Drop all existing conflicting policies
    - Create proper INSERT policy for photographers
    - Re-enable RLS with working policies

  2. Policy Logic
    - Allow photographers to create albums only for their own events
    - Validate ownership through events -> photographers -> user_id chain
    - Use WITH CHECK clause to ensure data integrity
*/

-- Temporarily disable RLS to clean up
ALTER TABLE albums DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow photographers to create their own albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_insert_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;
DROP POLICY IF EXISTS "public_can_select_active_albums" ON albums;

-- Re-enable RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy that allows photographers to create albums for their own events
CREATE POLICY "photographers_can_insert_albums_for_own_events"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE e.id = albums.event_id 
      AND p.user_id = auth.uid()
    )
  );

-- Create SELECT policy for photographers to view their own albums
CREATE POLICY "photographers_can_select_own_albums"
  ON albums
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE e.id = albums.event_id 
      AND p.user_id = auth.uid()
    )
  );

-- Create SELECT policy for public to view active albums
CREATE POLICY "public_can_select_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create UPDATE policy for photographers to update their own albums
CREATE POLICY "photographers_can_update_own_albums"
  ON albums
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE e.id = albums.event_id 
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE e.id = albums.event_id 
      AND p.user_id = auth.uid()
    )
  );

-- Create DELETE policy for photographers to delete their own albums
CREATE POLICY "photographers_can_delete_own_albums"
  ON albums
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE e.id = albums.event_id 
      AND p.user_id = auth.uid()
    )
  );