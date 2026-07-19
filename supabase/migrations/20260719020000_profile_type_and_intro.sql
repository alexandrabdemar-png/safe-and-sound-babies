-- Feature: profile type at signup (Parent, Parent-to-be, Pediatrician,
-- Daycare, Babysitter/Nanny, Caregiver) plus a one-time "what is this app"
-- intro modal shown once per account.
--
-- Non-parent caregiving roles (Pediatrician, Daycare, Babysitter/Nanny,
-- Caregiver) look after multiple children of varying ages rather than one
-- specific child, so they get a simple age-range field instead of creating
-- a single child profile during onboarding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_type text
    CHECK (profile_type IS NULL OR profile_type IN (
      'parent', 'parent_to_be', 'pediatrician', 'daycare', 'babysitter_nanny', 'caregiver'
    )),
  ADD COLUMN IF NOT EXISTS care_age_min_months integer
    CHECK (care_age_min_months IS NULL OR care_age_min_months >= 0),
  ADD COLUMN IF NOT EXISTS care_age_max_months integer
    CHECK (care_age_max_months IS NULL OR care_age_max_months >= 0),
  ADD COLUMN IF NOT EXISTS intro_seen_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_care_age_range_order;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_care_age_range_order
    CHECK (
      care_age_min_months IS NULL OR care_age_max_months IS NULL
      OR care_age_max_months >= care_age_min_months
    );
