/*
  # Fix subscription RLS policy

  1. Security Changes
    - Remove policies that reference users table
    - Create simple policy for users to read their own subscriptions
    - Add master user policy for full access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Master user can read all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;

-- Create simple, working policies
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

CREATE POLICY "Master user full access"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.email()) = 'valdigley2007@gmail.com'
  )
  WITH CHECK (
    (SELECT auth.email()) = 'valdigley2007@gmail.com'
  );