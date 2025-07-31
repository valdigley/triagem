/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - RLS policies on `users` table are causing infinite recursion
    - Complex policies with subqueries to other tables create circular dependencies
    - Specifically affecting subscription loading

  2. Solution
    - Remove all complex policies from `users` table
    - Create simple, direct policies based only on auth.uid()
    - Avoid any subqueries or references to other tables in `users` policies
    - Keep policies on other tables that reference `users` but simplify `users` policies

  3. Security
    - Users can only access their own data
    - Simple auth.uid() = id checks
    - No complex lookups that could cause recursion
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow insert for anon during registration" ON users;
DROP POLICY IF EXISTS "Master user can read all users" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create simple, non-recursive policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow anon users to insert during registration (needed for signup)
CREATE POLICY "Allow anon insert during registration"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Simple master user policy without subqueries
CREATE POLICY "Master user access"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.email() = 'valdigley2007@gmail.com')
  WITH CHECK (auth.email() = 'valdigley2007@gmail.com');