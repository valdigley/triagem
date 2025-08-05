/*
  # Fix albums table RLS policy for photographer inserts

  1. Security Changes
    - Drop existing conflicting policies on albums table
    - Create proper INSERT policy allowing photographers to create albums for their own events
    - Create SELECT policies for photographers and public access
    - Create UPDATE/DELETE policies for photographers to manage their own albums

  2. Policy Logic
    - INSERT: Allow if the event_id belongs to an event owned by the current photographer
    - SELECT: Allow photographers to see their own albums, public can see active albums
    - UPDATE/DELETE: Allow photographers to manage their own albums
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "photographers_can_insert_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;
DROP POLICY IF EXISTS "public_can_select_active_albums" ON albums;

-- Ensure RLS is enabled
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy for photographers to create albums for their own events
CREATE POLICY "photographers_can_insert_albums_for_own_events"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT p.user_id 
      FROM photographers p
      JOIN events e ON e.photographer_id = p.id
      WHERE e.id = event_id
    )
  );

-- Create SELECT policy for photographers to view their own albums
CREATE POLICY "photographers_can_select_own_albums"
  ON albums
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT p.user_id 
      FROM photographers p
      JOIN events e ON e.photographer_id = p.id
      WHERE e.id = event_id
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
    auth.uid() = (
      SELECT p.user_id 
      FROM photographers p
      JOIN events e ON e.photographer_id = p.id
      WHERE e.id = event_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT p.user_id 
      FROM photographers p
      JOIN events e ON e.photographer_id = p.id
      WHERE e.id = event_id
    )
  );

-- Create DELETE policy for photographers to delete their own albums
CREATE POLICY "photographers_can_delete_own_albums"
  ON albums
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT p.user_id 
      FROM photographers p
      JOIN events e ON e.photographer_id = p.id
      WHERE e.id = event_id
    )
  );