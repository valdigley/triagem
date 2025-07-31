/*
  # Add activity log to albums

  1. New Columns
    - `activity_log` (jsonb) - Array of activity entries with timestamp, type, and description
  
  2. Changes
    - Add activity_log column to albums table to track selection activities
    - Default to empty array for new albums
*/

-- Add activity_log column to albums table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'albums' AND column_name = 'activity_log'
  ) THEN
    ALTER TABLE albums ADD COLUMN activity_log jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for activity log queries
CREATE INDEX IF NOT EXISTS idx_albums_activity_log ON albums USING gin (activity_log);