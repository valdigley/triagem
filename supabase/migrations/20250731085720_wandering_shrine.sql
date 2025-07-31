/*
  # Fix subscription insert policy

  1. Security Changes
    - Add INSERT policy for subscriptions table
    - Allow authenticated users to create their own subscription records
    - Ensure user can only create subscription for themselves

  2. Policy Details
    - Policy name: "Users can insert own subscription"
    - Applies to: INSERT operations
    - Target: authenticated users
    - Condition: auth.uid() = user_id (user can only create subscription for themselves)
*/

-- Add INSERT policy for subscriptions table
CREATE POLICY "Users can insert own subscription"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);