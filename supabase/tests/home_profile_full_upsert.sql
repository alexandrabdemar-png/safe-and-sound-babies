-- Directly exercises home.tsx's saveHomeProfile(), which upserts all six
-- home_profile answers (has_stairs, home_type, has_pet, has_car,
-- in_daycare, has_pool) together in one call via
-- .upsert({ user_id, ...answers }, { onConflict: "user_id" }). Neither
-- existing home_profile test file covers that exact shape — one exercises
-- a direct multi-column INSERT, the other exercises a *partial* upsert
-- (dismissed_at only) — so this closes the specific gap of "does the
-- app's real first-save AND re-save (profile.tsx's 'Edit home profile')
-- payload actually round-trip every field it sends".
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('e5555555-5555-5555-5555-555555555555');

-- ── First save (INSERT path via ON CONFLICT) ──────────────────────────────
SELECT test.login('authenticated', 'e5555555-5555-5555-5555-555555555555');
INSERT INTO public.home_profile (user_id, has_stairs, home_type, has_pet, has_car, in_daycare, has_pool)
  VALUES ('e5555555-5555-5555-5555-555555555555', true, 'house', false, true, 'daycare', false)
  ON CONFLICT (user_id) DO UPDATE SET
    has_stairs = EXCLUDED.has_stairs,
    home_type = EXCLUDED.home_type,
    has_pet = EXCLUDED.has_pet,
    has_car = EXCLUDED.has_car,
    in_daycare = EXCLUDED.in_daycare,
    has_pool = EXCLUDED.has_pool;

SELECT test.assert(
  (SELECT has_stairs = true AND home_type = 'house' AND has_pet = false
     AND has_car = true AND in_daycare = 'daycare' AND has_pool = false
     FROM public.home_profile WHERE user_id = 'e5555555-5555-5555-5555-555555555555'),
  'First save: all 6 answers round-trip exactly as sent'
);

-- ── Re-save via "Edit home profile" (UPDATE path via the same upsert,
--    every answer changed) — proves it's a real overwrite, not a no-op
--    that happens to match because ON CONFLICT silently did nothing ──────
INSERT INTO public.home_profile (user_id, has_stairs, home_type, has_pet, has_car, in_daycare, has_pool)
  VALUES ('e5555555-5555-5555-5555-555555555555', false, 'apartment', true, false, 'both', true)
  ON CONFLICT (user_id) DO UPDATE SET
    has_stairs = EXCLUDED.has_stairs,
    home_type = EXCLUDED.home_type,
    has_pet = EXCLUDED.has_pet,
    has_car = EXCLUDED.has_car,
    in_daycare = EXCLUDED.in_daycare,
    has_pool = EXCLUDED.has_pool;

SELECT test.assert(
  (SELECT has_stairs = false AND home_type = 'apartment' AND has_pet = true
     AND has_car = false AND in_daycare = 'both' AND has_pool = true
     FROM public.home_profile WHERE user_id = 'e5555555-5555-5555-5555-555555555555'),
  'Re-save (Edit home profile): every answer actually overwrote the previous value'
);

SELECT test.assert(
  (SELECT count(*) FROM public.home_profile WHERE user_id = 'e5555555-5555-5555-5555-555555555555') = 1,
  'Exactly one row exists — the upsert updated in place, it did not create a second row'
);
SELECT test.logout();

-- ── The stray in_daycare_new column (20260815000000) is gone ─────────────
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'home_profile' AND column_name = 'in_daycare_new'
  ),
  'Stray in_daycare_new column from the duplicate migration has been dropped'
);
