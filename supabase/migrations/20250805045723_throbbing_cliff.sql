/*
  # Fix albums table RLS INSERT policy

  1. Security
    - Drop existing INSERT policy that may be incorrectly configured
    - Create new INSERT policy that properly validates photographer ownership
    - Ensure photographers can only create albums for their own events

  2. Changes
    - Remove conflicting INSERT policy
    - Add proper INSERT policy with correct event ownership validation
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON albums;

-- Create new INSERT policy that allows photographers to create albums for their own events
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