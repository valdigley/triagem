/*
  # Fix albums RLS policies for independent albums

  1. Security Changes
    - Update INSERT policy to allow albums without events
    - Update SELECT policy to handle independent albums
    - Update UPDATE policy for consistency
    - Update DELETE policy for consistency

  2. Changes Made
    - Allow photographers to create albums without event_id
    - Maintain security for event-linked albums
    - Support independent albums for manual workflows
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "photographers_can_insert_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;

-- Create new simplified policies that work for both independent and event-linked albums
CREATE POLICY "photographers_can_insert_albums" ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if event_id is null (independent album) and user is a photographer
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p 
      WHERE p.user_id = auth.uid()
    ))
    OR
    -- Allow if event_id belongs to photographer's event
    (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_select_own_albums" ON albums
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if independent album and user is a photographer
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p 
      WHERE p.user_id = auth.uid()
    ))
    OR
    -- Allow if event belongs to photographer
    (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_update_own_albums" ON albums
  FOR UPDATE
  TO authenticated
  USING (
    -- Same logic as SELECT
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p 
      WHERE p.user_id = auth.uid()
    ))
    OR
    (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    -- Same logic as INSERT
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p 
      WHERE p.user_id = auth.uid()
    ))
    OR
    (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    ))
  );

CREATE POLICY "photographers_can_delete_own_albums" ON albums
  FOR DELETE
  TO authenticated
  USING (
    -- Same logic as SELECT
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p 
      WHERE p.user_id = auth.uid()
    ))
    OR
    (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    ))
  );