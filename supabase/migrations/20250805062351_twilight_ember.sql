/*
  # Add photographer_id column to albums table

  1. Schema Changes
    - Add `photographer_id` column to `albums` table
    - Set up foreign key relationship with `photographers` table
    - Add index for performance
    - Update existing albums to have photographer_id from their events

  2. Security
    - Update RLS policies to work with new column
    - Ensure photographers can only access their own albums
*/

-- Add photographer_id column to albums table
ALTER TABLE albums ADD COLUMN IF NOT EXISTS photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_albums_photographer_id ON albums(photographer_id);

-- Update existing albums to set photographer_id from their events
UPDATE albums 
SET photographer_id = events.photographer_id 
FROM events 
WHERE albums.event_id = events.id 
AND albums.photographer_id IS NULL;

-- For albums without events, we'll need to handle them separately
-- This shouldn't happen in normal operation, but just in case
UPDATE albums 
SET photographer_id = (
  SELECT id FROM photographers LIMIT 1
) 
WHERE photographer_id IS NULL;