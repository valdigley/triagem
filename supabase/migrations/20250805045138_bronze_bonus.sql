/*
  # Fix albums table RLS policy for insert operations

  1. Security Updates
    - Add INSERT policy for albums table
    - Allow photographers to create albums only for their own events
    - Ensure proper validation through event ownership

  2. Policy Details
    - Policy name: "Photographers can insert albums for own events"
    - Allows INSERT operations when event belongs to photographer
    - Uses WITH CHECK to validate event ownership
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Photographers can insert albums for own events" ON albums;

-- Create INSERT policy for albums
CREATE POLICY "Photographers can insert albums for own events"
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