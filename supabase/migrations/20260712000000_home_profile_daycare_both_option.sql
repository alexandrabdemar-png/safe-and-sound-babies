-- Adds a "both" option to the home-profile setup's daycare question (was a
-- plain boolean — daycare vs. home — with no way to represent a baby who's
-- in daycare part of the week and home the rest, per live user feedback).
-- Converts the existing boolean column to text so it can hold
-- 'daycare' | 'home' | 'both' (or NULL for "never answered").
ALTER TABLE public.home_profile
  ADD COLUMN IF NOT EXISTS in_daycare_new text;

UPDATE public.home_profile
  SET in_daycare_new = CASE
    WHEN in_daycare IS TRUE THEN 'daycare'
    WHEN in_daycare IS FALSE THEN 'home'
    ELSE NULL
  END
  WHERE in_daycare_new IS NULL;

ALTER TABLE public.home_profile DROP COLUMN IF EXISTS in_daycare;
ALTER TABLE public.home_profile RENAME COLUMN in_daycare_new TO in_daycare;

ALTER TABLE public.home_profile
  DROP CONSTRAINT IF EXISTS home_profile_in_daycare_check;
ALTER TABLE public.home_profile
  ADD CONSTRAINT home_profile_in_daycare_check
  CHECK (in_daycare IS NULL OR in_daycare IN ('daycare', 'home', 'both'));
