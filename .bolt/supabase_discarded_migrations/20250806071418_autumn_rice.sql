/*
  # Fix RLS policies for user registration and profile creation

  1. Policy Updates
    - Allow authenticated users to insert their own data in users table
    - Allow authenticated users to insert their own photographer profile
    - Allow authenticated users to insert their own subscription
    - Fix policy conditions to work with auth.uid()

  2. Security
    - Maintain security while allowing proper user registration
    - Ensure users can only access their own data
    - Allow initial profile creation for new users
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow anon insert during registration" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "photographers_insert_own" ON photographers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON subscriptions;

-- Create new, working policies for users table
CREATE POLICY "Users can insert own profile during registration"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create new, working policies for photographers table
CREATE POLICY "Photographers can insert own profile"
  ON photographers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Photographers can read own profile"
  ON photographers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Photographers can update own profile"
  ON photographers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create new, working policies for subscriptions table
CREATE POLICY "Users can insert own subscription"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep master user policies
CREATE POLICY "Master user can manage all users"
  ON users
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

CREATE POLICY "Master user can manage all photographers"
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

CREATE POLICY "Master user can manage all subscriptions"
  ON subscriptions
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

-- Ensure the trigger function exists for creating subscriptions
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create subscription for new user
  INSERT INTO subscriptions (user_id, plan_type, status, trial_start_date, trial_end_date)
  VALUES (
    NEW.id,
    'trial',
    'active',
    NOW(),
    NOW() + INTERVAL '7 days'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create subscription for new users
DROP TRIGGER IF EXISTS create_subscription_on_user_insert ON users;
CREATE TRIGGER create_subscription_on_user_insert
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_subscription();