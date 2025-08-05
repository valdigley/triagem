/*
  # Allow independent album creation

  1. Changes
    - Modify albums table to make event_id optional
    - Update RLS policies to allow albums without events
    - Add support for standalone albums

  2. Security
    - Maintain RLS for photographer ownership
    - Allow albums with or without events
*/

-- Make event_id optional in albums table
ALTER TABLE albums ALTER COLUMN event_id DROP NOT NULL;

-- Drop existing INSERT policy and create new one that allows independent albums
DROP POLICY IF EXISTS "photographers_can_insert_albums" ON albums;

CREATE POLICY "photographers_can_insert_albums" ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if no event_id (independent album)
    event_id IS NULL OR
    -- Or if event belongs to the photographer
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Update other policies to handle NULL event_id
DROP POLICY IF EXISTS "photographers_can_select_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_update_own_albums" ON albums;
DROP POLICY IF EXISTS "photographers_can_delete_own_albums" ON albums;

CREATE POLICY "photographers_can_select_own_albums" ON albums
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if no event_id (independent album) and user is photographer
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p WHERE p.user_id = auth.uid()
    )) OR
    -- Or if event belongs to the photographer
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "photographers_can_update_own_albums" ON albums
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if no event_id (independent album) and user is photographer
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p WHERE p.user_id = auth.uid()
    )) OR
    -- Or if event belongs to the photographer
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for updates
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p WHERE p.user_id = auth.uid()
    )) OR
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "photographers_can_delete_own_albums" ON albums
  FOR DELETE
  TO authenticated
  USING (
    -- Allow if no event_id (independent album) and user is photographer
    (event_id IS NULL AND EXISTS (
      SELECT 1 FROM photographers p WHERE p.user_id = auth.uid()
    )) OR
    -- Or if event belongs to the photographer
    event_id IN (
      SELECT e.id
      FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Add index for better performance on NULL event_id queries
CREATE INDEX IF NOT EXISTS idx_albums_event_id_null ON albums (id) WHERE event_id IS NULL;