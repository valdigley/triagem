/*
  # Fix API Access RLS Policies

  1. Security Updates
    - Drop existing problematic policies that reference users table
    - Create new simplified policies using only auth functions
    - Grant necessary permissions for authenticated users

  2. New Policies
    - Users can read their own API access data
    - Users can create their own API access data  
    - Users can update their own API access data
    - Master user can read all API access data

  3. Permissions
    - Grant SELECT on auth.users to authenticated role
*/

-- Grant necessary permissions
GRANT SELECT ON auth.users TO authenticated;

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can read own API access" ON api_access;
DROP POLICY IF EXISTS "Users can update own API access" ON api_access;
DROP POLICY IF EXISTS "Master user can read all API access" ON api_access;

-- Create new simplified policies
CREATE POLICY "Users can read own API access"
  ON api_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API access"
  ON api_access
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API access"
  ON api_access
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Master user policy using auth.email() directly
CREATE POLICY "Master user can read all API access"
  ON api_access
  FOR ALL
  TO authenticated
  USING (auth.email() = 'valdigley2007@gmail.com')
  WITH CHECK (auth.email() = 'valdigley2007@gmail.com');