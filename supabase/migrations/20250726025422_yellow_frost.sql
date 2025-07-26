/*
  # Add session_type column to events table

  1. Changes
    - Add `session_type` column to `events` table
    - Column is TEXT type and NOT NULL
    - Used to store the type of photography session (gestante, aniversario, etc.)

  2. Notes
    - This column will store session categories like 'gestante', 'aniversario', 'comerciais', etc.
    - Required field for better organization and filtering of events
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'session_type'
  ) THEN
    ALTER TABLE events ADD COLUMN session_type text;
  END IF;
END $$;