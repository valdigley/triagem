/*
  # Fix photographer constraints and RLS policies

  1. Database Changes
    - Add unique constraint on user_id in photographers table
    - Fix RLS policies that may be causing 406 errors
    - Ensure proper indexes exist

  2. Security
    - Update RLS policies to be more permissive for authenticated users
    - Fix policy conflicts that cause 406 Not Acceptable errors
*/

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'photographers_user_id_unique' 
    AND table_name = 'photographers'
  ) THEN
    ALTER TABLE photographers ADD CONSTRAINT photographers_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Update RLS policies to fix 406 errors
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON photographers;
DROP POLICY IF EXISTS "Allow insert for anon during registration" ON photographers;

-- Create more permissive policies
CREATE POLICY "photographers_select_own" 
  ON photographers 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "photographers_insert_own" 
  ON photographers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "photographers_update_own" 
  ON photographers 
  FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "photographers_delete_own" 
  ON photographers 
  FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());

-- Allow master user to access all photographers
CREATE POLICY "photographers_master_access" 
  ON photographers 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_photographers_user_id_unique ON photographers(user_id);