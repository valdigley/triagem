/*
  # Add Google Drive link to albums

  1. Changes
    - Add `google_drive_link` column to `albums` table
    - Column stores the Google Drive folder/file link for edited photos
    - Used for sharing final edited photos with clients

  2. Security
    - No RLS changes needed as albums already have proper policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'albums' AND column_name = 'google_drive_link'
  ) THEN
    ALTER TABLE albums ADD COLUMN google_drive_link text;
  END IF;
END $$;