/*
  # Fix albums table RLS INSERT policy

  1. Problem
    - Users getting "new row violates row-level security policy" when creating albums
    - Current INSERT policy is preventing authenticated users from creating albums

  2. Solution
    - Drop existing INSERT policy that's causing conflicts
    - Create new INSERT policy using expert recommended condition
    - Policy allows users to create albums only for events they own through photographer profile

  3. Security
    - Maintains security by ensuring users can only create albums for their own events
    - Uses proper JOIN to verify ownership through photographer profile
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON albums;

-- Create new INSERT policy using expert recommended solution
CREATE POLICY "photographers_can_insert_albums_for_own_events" ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM events e 
      JOIN photographers p ON e.photographer_id = p.id 
      WHERE e.id = event_id AND p.user_id = auth.uid()
    )
  );