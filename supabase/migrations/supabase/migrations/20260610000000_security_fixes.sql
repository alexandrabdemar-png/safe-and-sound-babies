-- Fix 1: SECURITY DEFINER milestone function
-- Remove elevated privileges from milestone function
ALTER FUNCTION IF EXISTS generate_milestones(uuid) SECURITY INVOKER;
ALTER FUNCTION IF EXISTS create_milestone(uuid, text, date, text) SECURITY INVOKER;

-- Fix 2: Lock down recall-sync admin endpoint
-- Only service role can call recall sync
REVOKE ALL ON FUNCTION sync_recalls() FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_recalls() FROM authenticated;

-- Fix 3: Lock down admin hook endpoints  
REVOKE ALL ON FUNCTION handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Fix 4: Prevent users from writing their own subscriptions
-- Users can read their own subscription but only service_role can write
DROP POLICY IF EXISTS "Users can insert subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions" ON subscriptions;

-- Read only for users
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription" 
ON subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- Only service role (Stripe webhook) can write subscriptions
CREATE POLICY "Service role manages subscriptions" 
ON subscriptions FOR ALL 
USING (auth.role() = 'service_role');

-- Fix 5: RLS on all main tables if not already enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Ensure users can only see their own data
DROP POLICY IF EXISTS "Users own products" ON products;
CREATE POLICY "Users own products" ON products
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own children" ON children;
CREATE POLICY "Users own children" ON children
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own milestones" ON milestones;
CREATE POLICY "Users own milestones" ON milestones
FOR ALL USING (
  child_id IN (
    SELECT id FROM children WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own push tokens" ON push_tokens;
CREATE POLICY "Users own push tokens" ON push_tokens
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own alerts" ON product_alerts;
CREATE POLICY "Users own alerts" ON product_alerts
FOR ALL USING (
  product_id IN (
    SELECT id FROM products WHERE user_id = auth.uid()
  )
);
