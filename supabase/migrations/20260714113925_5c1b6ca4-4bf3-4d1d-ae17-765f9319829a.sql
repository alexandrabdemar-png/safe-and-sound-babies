
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS recall_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version)
);

GRANT SELECT, INSERT ON public.user_agreements TO authenticated;
GRANT ALL ON public.user_agreements TO service_role;

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_agreements' AND policyname='Users view own agreements') THEN
    CREATE POLICY "Users view own agreements" ON public.user_agreements
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_agreements' AND policyname='Users record own agreements') THEN
    CREATE POLICY "Users record own agreements" ON public.user_agreements
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_agreements_user ON public.user_agreements(user_id);
