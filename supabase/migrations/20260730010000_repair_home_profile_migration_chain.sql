-- Repairs a broken migration sequence on public.home_profile.
--
-- 20260713230404_c7c50442-e0a8-4833-af90-6c2365e12a96.sql is an accidental
-- exact duplicate of 20260712000000_home_profile_daycare_both_option.sql
-- (both convert in_daycare from boolean to text). Verified by replaying
-- both against a real Postgres: once the first one succeeds and in_daycare
-- is already text, the duplicate's UPDATE statement
-- ("in_daycare IS TRUE") throws "argument of IS TRUE must be type
-- boolean, not type text" — a genuine SQL error, not a hypothetical one.
--
-- If the live migration runner treats that as fatal, everything after it
-- in sequence — including 20260713230635_b72382c7-...sql, which adds
-- dismissed_at — may never have applied. Reported symptom: "Edit home
-- profile" (profile.tsx) sends the user back to Home, whose home_profile
-- load explicitly selects dismissed_at (home.tsx:510) — a missing column
-- there surfaces as the generic "Something went wrong on our end" toast.
--
-- Every step below is idempotent and safe regardless of which partial
-- state the live database is actually in (stuck before the boolean->text
-- conversion, stuck after it but missing dismissed_at, or already fully
-- up to date) — safe to run more than once.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'home_profile'
      AND column_name = 'in_daycare' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE public.home_profile ADD COLUMN IF NOT EXISTS in_daycare_new text;
    UPDATE public.home_profile
      SET in_daycare_new = CASE
        WHEN in_daycare IS TRUE THEN 'daycare'
        WHEN in_daycare IS FALSE THEN 'home'
        ELSE NULL
      END
      WHERE in_daycare_new IS NULL;
    ALTER TABLE public.home_profile DROP COLUMN in_daycare;
    ALTER TABLE public.home_profile RENAME COLUMN in_daycare_new TO in_daycare;
  END IF;
END $$;

ALTER TABLE public.home_profile
  DROP CONSTRAINT IF EXISTS home_profile_in_daycare_check;
ALTER TABLE public.home_profile
  ADD CONSTRAINT home_profile_in_daycare_check
  CHECK (in_daycare IS NULL OR in_daycare IN ('daycare', 'home', 'both'));

ALTER TABLE public.home_profile
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
