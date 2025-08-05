/*
  # Fix albums table RLS policy for INSERT operations

  1. Problem
    - Users getting "new row violates row-level security policy" when creating albums
    - Missing proper INSERT policy for authenticated photographers

  2. Solution
    - Drop existing conflicting INSERT policy if it exists
    - Create new INSERT policy that allows photographers to create albums only for their own events
    - Use the exact pattern recommended by the expert

  3. Security
    - Only authenticated users can insert
    - Users can only create albums for events they own (through photographer profile)
    - Uses proper JOIN between events and photographers tables
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "photographers_can_insert_albums_for_own_events" ON public.albums;
DROP POLICY IF EXISTS "Allow photographers to create albums for own events" ON public.albums;
DROP POLICY IF EXISTS "Photographers can create albums for own events" ON public.albums;

-- Create the exact policy recommended by the expert
CREATE POLICY "Allow photographers to create their own albums" 
ON public.albums 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.events e 
    JOIN public.photographers p ON e.photographer_id = p.id 
    WHERE e.id = albums.event_id AND p.user_id = auth.uid()
  )
);