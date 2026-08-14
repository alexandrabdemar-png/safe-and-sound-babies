-- Browser Web Push subscriptions for recall alerts. Sits alongside the
-- existing native-app channel (profiles.apns_device_token, delivered via
-- Apple Push in supabase/functions/_shared/notify.ts) as a second delivery
-- channel for users on the web app, where there's no native push service —
-- Web Push (RFC 8030/8291) is the browser-native equivalent.
--
-- One row per browser/device subscription (a user can have several — e.g.
-- one per browser they've granted permission in). `endpoint` is unique
-- because the Push API spec guarantees it's unique per subscription; a
-- re-subscribe from the same browser reuses the same endpoint, so upserting
-- on it is how re-registration and cleanup both stay simple.
--
-- Note: recalls(source, source_id) already has a UNIQUE constraint from
-- migration 20260607215835 — no change needed there for dedup on repeated
-- pipeline runs.
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx
  ON public.web_push_subscriptions (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated;
GRANT ALL ON public.web_push_subscriptions TO service_role;

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own web push subscriptions"
  ON public.web_push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.web_push_subscriptions IS
  'Browser PushSubscription rows (Web Push API) for recall alerts. Read by the scheduled-recall-check edge function via the service role, which bypasses RLS.';
