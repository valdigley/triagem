/*
  # Fix albums table RLS policy for INSERT operations

  1. Problem
    - Current INSERT policy is blocking album creation
    - Need to allow photographers to create albums for their own events

  2. Solution
    - Drop existing INSERT policy that's causing issues
    - Create new INSERT policy using exact same pattern as existing SELECT policy
    - Ensure photographers can only create albums for events they own

  3. Security
    - Maintains security by validating photographer ownership
    - Uses same validation pattern as existing working policies
*/

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON albums;

-- Create new INSERT policy using the exact same pattern as the working SELECT policy
CREATE POLICY "photographers_can_insert_albums_for_own_events"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM (events e
        JOIN photographers p ON ((e.photographer_id = p.id)))
      WHERE ((e.id = albums.event_id) AND (p.user_id = uid()))
    )
  );