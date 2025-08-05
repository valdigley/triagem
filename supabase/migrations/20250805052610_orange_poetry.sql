/*
  # Fix albums RLS policy for INSERT operations

  1. Problem
    - Current RLS policy prevents authenticated users from creating albums
    - Getting 403 Forbidden error when trying to insert new albums

  2. Solution
    - Drop existing problematic INSERT policy
    - Create new INSERT policy that allows photographers to create albums for their own events
    - Use the exact condition recommended by the expert

  3. Security
    - Ensures users can only create albums for events they own through their photographer profile
    - Maintains data isolation between different photographers
*/

-- Drop existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON albums;

-- Create new INSERT policy with the exact condition recommended by the expert
CREATE POLICY "Allow photographers to insert albums for own events"
  ON albums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.events 
      WHERE events.id = albums.event_id 
        AND events.photographer_id = (
          SELECT id 
          FROM public.photographers 
          WHERE user_id = auth.uid()
        )
    )
  );