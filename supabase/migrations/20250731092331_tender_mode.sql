/*
  # Fix Database Registration Error

  1. Database Issues Fixed
    - Drop and recreate handle_new_user function with proper error handling
    - Ensure users table exists with correct structure
    - Fix trigger to handle registration properly
    - Add proper RLS policies for registration

  2. Security
    - Enable RLS on users table
    - Add policies for user registration and data access
    - Ensure proper permissions for auth operations

  3. Error Prevention
    - Add IF NOT EXISTS checks
    - Handle potential constraint violations
    - Add proper exception handling in trigger function
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Ensure users table exists with correct structure
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'photographer'::text,
  avatar text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['admin'::text, 'photographer'::text, 'client'::text]))
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Create RLS policies
CREATE POLICY "Enable insert for authenticated users only"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create robust handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_name text;
  user_email text;
BEGIN
  -- Extract email (required)
  user_email := NEW.email;
  
  -- Extract name from metadata or use email prefix as fallback
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Ensure we have valid data
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'User email is required';
  END IF;
  
  IF user_name IS NULL OR user_name = '' THEN
    user_name := split_part(user_email, '@', 1);
  END IF;
  
  -- Insert into public.users with error handling
  BEGIN
    INSERT INTO public.users (id, email, name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      user_email,
      user_name,
      'photographer',
      now(),
      now()
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists, update instead
      UPDATE public.users 
      SET 
        name = user_name,
        updated_at = now()
      WHERE id = NEW.id;
    WHEN OTHERS THEN
      -- Log error but don't fail the auth registration
      RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure photographers table exists and has proper structure
CREATE TABLE IF NOT EXISTS public.photographers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text NOT NULL,
  google_calendar_id text,
  ftp_config jsonb,
  watermark_config jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on photographers
ALTER TABLE public.photographers ENABLE ROW LEVEL SECURITY;

-- Create photographers policies
DROP POLICY IF EXISTS "Photographers can insert own data" ON public.photographers;
DROP POLICY IF EXISTS "Photographers can read own data" ON public.photographers;
DROP POLICY IF EXISTS "Photographers can update own data" ON public.photographers;

CREATE POLICY "Photographers can insert own data"
  ON public.photographers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Photographers can read own data"
  ON public.photographers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Photographers can update own data"
  ON public.photographers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for photographers
CREATE INDEX IF NOT EXISTS idx_photographers_user_id ON public.photographers(user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.photographers TO anon, authenticated;