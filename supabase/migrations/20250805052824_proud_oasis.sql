/*
  # Fix albums RLS policy completely

  1. Security Changes
    - Drop all existing problematic policies
    - Create simple and working INSERT policy
    - Ensure proper permissions for album creation

  2. Policy Updates
    - Allow photographers to insert albums for their own events
    - Use simplified validation logic
    - Match existing working patterns
*/

-- Disable RLS temporarily to clean up
ALTER TABLE albums DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow photographers to insert albums for own events" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;
DROP POLICY IF EXISTS "public_can_select_active_albums" ON albums;

-- Re-enable RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Create working INSERT policy (simplified)
CREATE POLICY "photographers_can_insert_albums"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT e.id 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create SELECT policy
CREATE POLICY "photographers_can_select_own_albums"
  ON albums
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create UPDATE policy
CREATE POLICY "photographers_can_update_own_albums"
  ON albums
  FOR UPDATE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT e.id 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create DELETE policy
CREATE POLICY "photographers_can_delete_own_albums"
  ON albums
  FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create public SELECT policy for active albums
CREATE POLICY "public_can_select_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);