/*
  # Complete RLS Policy Recreation

  This migration completely recreates all RLS policies to fix authentication errors.
  
  1. Security Changes
     - Drop all existing problematic policies
     - Create new simplified policies that work with auth.uid()
     - Ensure proper user registration flow
     - Maintain data security while allowing proper access
  
  2. Tables Updated
     - users: Allow registration and self-management
     - photographers: Allow profile creation and management
     - subscriptions: Allow subscription management
     - events: Allow event management by photographers
     - albums: Allow album management
     - photos: Allow photo management
     - orders: Allow order creation and viewing
     - clients: Allow client management
     - api_access: Allow API key management
     - payment_transactions: Allow transaction viewing
     - subscription_plans: Public read access
     - webhook_logs: Allow logging
  
  3. Master User Access
     - Maintains full access for valdigley2007@gmail.com
     - All other users have restricted access to their own data
*/

-- Drop all existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies from all tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Helper function to get user email
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USERS TABLE POLICIES
CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_master_access" ON users
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- Allow anonymous insert during registration
CREATE POLICY "users_anon_insert" ON users
  FOR INSERT TO anon
  WITH CHECK (true);

-- PHOTOGRAPHERS TABLE POLICIES
CREATE POLICY "photographers_insert_own" ON photographers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "photographers_select_own" ON photographers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "photographers_update_own" ON photographers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "photographers_delete_own" ON photographers
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "photographers_master_access" ON photographers
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- SUBSCRIPTIONS TABLE POLICIES
CREATE POLICY "subscriptions_insert_own" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_update_own" ON subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_master_access" ON subscriptions
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- EVENTS TABLE POLICIES
CREATE POLICY "events_manage_own" ON events
  FOR ALL TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  );

-- ALBUMS TABLE POLICIES
CREATE POLICY "albums_manage_own" ON albums
  FOR ALL TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
    OR
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Public read access for active albums
CREATE POLICY "albums_public_read_active" ON albums
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- PHOTOS TABLE POLICIES
CREATE POLICY "photos_manage_own" ON photos
  FOR ALL TO authenticated
  USING (
    album_id IN (
      SELECT a.id FROM albums a
      JOIN photographers p ON (
        a.photographer_id = p.id 
        OR a.event_id IN (
          SELECT e.id FROM events e WHERE e.photographer_id = p.id
        )
      )
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT a.id FROM albums a
      JOIN photographers p ON (
        a.photographer_id = p.id 
        OR a.event_id IN (
          SELECT e.id FROM events e WHERE e.photographer_id = p.id
        )
      )
      WHERE p.user_id = auth.uid()
    )
  );

-- Public read access for photos in active albums
CREATE POLICY "photos_public_read_active" ON photos
  FOR SELECT TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

-- Public update for photo selection
CREATE POLICY "photos_public_update_selection" ON photos
  FOR UPDATE TO anon, authenticated
  USING (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  )
  WITH CHECK (
    album_id IN (
      SELECT id FROM albums WHERE is_active = true
    )
  );

-- ORDERS TABLE POLICIES
CREATE POLICY "orders_insert_public" ON orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "orders_select_own_events" ON orders
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN photographers p ON e.photographer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- CLIENTS TABLE POLICIES
CREATE POLICY "clients_manage_own" ON clients
  FOR ALL TO authenticated
  USING (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    photographer_id IN (
      SELECT id FROM photographers WHERE user_id = auth.uid()
    )
  );

-- API_ACCESS TABLE POLICIES
CREATE POLICY "api_access_insert_own" ON api_access
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_access_select_own" ON api_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "api_access_update_own" ON api_access
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_access_master_access" ON api_access
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- PAYMENT_TRANSACTIONS TABLE POLICIES
CREATE POLICY "payment_transactions_select_own" ON payment_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "payment_transactions_master_access" ON payment_transactions
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- SUBSCRIPTION_PLANS TABLE POLICIES
CREATE POLICY "subscription_plans_public_read" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "subscription_plans_master_manage" ON subscription_plans
  FOR ALL TO authenticated
  USING (get_user_email() = 'valdigley2007@gmail.com')
  WITH CHECK (get_user_email() = 'valdigley2007@gmail.com');

-- WEBHOOK_LOGS TABLE POLICIES
CREATE POLICY "webhook_logs_public_read" ON webhook_logs
  FOR SELECT TO authenticated
  USING (true);

-- Create trigger function for automatic subscription creation
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create subscription if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.subscriptions (
      user_id,
      plan_type,
      status,
      trial_start_date,
      trial_end_date
    ) VALUES (
      NEW.id,
      'trial',
      'active',
      NOW(),
      NOW() + INTERVAL '7 days'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create subscription when user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_subscription();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- Ensure RLS is enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;