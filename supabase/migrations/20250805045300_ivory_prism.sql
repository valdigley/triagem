/*
  # Fix albums table RLS policies

  1. Security Changes
    - Drop existing conflicting policies
    - Create proper INSERT policy for photographers to create albums for their own events
    - Create proper SELECT policy for photographers to view their own albums
    - Create proper UPDATE/DELETE policies for photographers to manage their own albums
    - Maintain public SELECT policy for active albums with share tokens

  2. Policy Details
    - INSERT: Allow photographers to create albums for events they own
    - SELECT: Allow photographers to view their own albums + public access to active albums
    - UPDATE/DELETE: Allow photographers to manage albums for their own events
*/

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Photographers can insert albums for own events" ON albums;
DROP POLICY IF EXISTS "Photographers can manage albums of own events" ON albums;
DROP POLICY IF EXISTS "Public can read albums with share_token" ON albums;

-- Create comprehensive INSERT policy
CREATE POLICY "photographers_can_insert_own_albums"
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

-- Create SELECT policy for photographers to view their own albums
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

-- Create public SELECT policy for active albums (for client access)
CREATE POLICY "public_can_select_active_albums"
  ON albums
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create UPDATE policy for photographers
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

-- Create DELETE policy for photographers
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