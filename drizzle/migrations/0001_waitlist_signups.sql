-- Pre-launch waitlist (public /waitlist page, linked from social bios).
--
-- Anyone can join (anon INSERT), but nobody can read the list through the
-- API: there is deliberately no SELECT policy. View or export signups in the
-- Supabase dashboard (Table Editor → waitlist_signups → Export to CSV).
-- The only public read is the total count, through waitlist_count().

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL
    CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name text CHECK (first_name IS NULL OR char_length(first_name) <= 80),
  stage text CHECK (stage IS NULL OR stage IN ('expecting', 'newborn', 'baby', 'toddler', 'other')),
  -- Where the signup came from, from the page's ?ref= link (e.g. 'tiktok').
  source text CHECK (source IS NULL OR source ~ '^[a-z0-9_-]{1,40}$'),
  -- The form can't be submitted without this ticked; stored as proof of consent.
  consented_to_emails boolean NOT NULL CHECK (consented_to_emails),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One signup per email, case-insensitively. The page treats a duplicate
-- (error 23505) as success, so it never reveals whether an email is listed.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_lower_key
  ON public.waitlist_signups (lower(email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist_signups' AND policyname = 'Anyone can join the waitlist'
  ) THEN
    CREATE POLICY "Anyone can join the waitlist" ON public.waitlist_signups
      FOR INSERT TO anon, authenticated
      WITH CHECK (consented_to_emails);
  END IF;
END $$;

REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;
GRANT INSERT ON public.waitlist_signups TO anon, authenticated;

-- Total signups, for the "join N parents" line. Exposes a number only.
CREATE OR REPLACE FUNCTION public.waitlist_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.waitlist_signups;
$$;

REVOKE ALL ON FUNCTION public.waitlist_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_count() TO anon, authenticated;
