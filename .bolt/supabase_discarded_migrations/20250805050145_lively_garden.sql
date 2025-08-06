/*
  # Fix albums table RLS INSERT policy

  1. Security Changes
    - Drop existing INSERT policy that's causing RLS violations
    - Create new INSERT policy using the same pattern as existing working policies
    - Ensure photographers can only create albums for their own events

  2. Policy Details
    - Uses the exact same JOIN pattern as existing photographers_can_select_own_albums policy
    - Validates that the event belongs to the photographer making the request
    - Maintains security while allowing proper album creation
*/

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON albums;

-- Create new INSERT policy using the exact same pattern as the working SELECT policy
CREATE POLICY "photographers_can_insert_albums_for_own_events" ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uid() = (
      SELECT p.user_id
      FROM (photographers p
        JOIN events e ON ((e.photographer_id = p.id)))
      WHERE (e.id = albums.event_id)
    )
  );