/*
  # Fix albums table RLS policies

  1. Security Changes
    - Drop existing INSERT policy that may be causing conflicts
    - Create new INSERT policy allowing photographers to create albums for their own events
    - Ensure policy uses proper authentication and ownership validation

  2. Policy Details
    - INSERT policy validates that the event_id belongs to the authenticated photographer
    - Uses EXISTS clause with proper JOIN to verify ownership
    - Maintains security while allowing legitimate album creation
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