/*
  # Fix RLS permissions for users and subscriptions tables

  1. Security Updates
    - Enable RLS on users table
    - Add policy for users to read their own data
    - Update subscription policies to work correctly
    - Add master user permissions

  2. Changes
    - Users can read their own profile data
    - Users can read their own subscription data
    - Master user (valdigley2007@gmail.com) has full access
*/

-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read their own user profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;

-- Create policies for users table
CREATE POLICY "Users can read own data" 
  ON public.users 
  FOR SELECT 
  TO authenticated 
  USING (id = auth.uid());

CREATE POLICY "Users can update own data" 
  ON public.users 
  FOR UPDATE 
  TO authenticated 
  USING (id = auth.uid()) 
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own data" 
  ON public.users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (id = auth.uid());

-- Master user can read all users
CREATE POLICY "Master user can read all users" 
  ON public.users 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );

-- Ensure subscriptions table has correct RLS policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing subscription policies to recreate them
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Master user can read all subscriptions" ON public.subscriptions;

-- Recreate subscription policies with correct references
CREATE POLICY "Users can read own subscription" 
  ON public.subscriptions 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own subscription" 
  ON public.subscriptions 
  FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Master user can read all subscriptions" 
  ON public.subscriptions 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );