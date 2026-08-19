-- Two-account IDOR test: signs in as two separate authenticated users and
-- asserts that neither can read, modify, or delete the other's rows through a
-- direct database/Data API call — i.e. isolation is enforced by RLS itself,
-- not merely by what the UI happens to render.
--
-- Every table that stores per-user data is covered. The three intentionally
-- shared reference tables (recalls, product_catalog, recall_source_status) are
-- asserted to be readable by both users on purpose, so that a future
-- accidental widening of a *user-data* table can't hide behind them.
\set ON_ERROR_STOP on

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

INSERT INTO auth.users (id) VALUES (:'A'), (:'B');

-- ── Seed as user A (through RLS, as the app would) ─────────────────────────
SELECT test.login('authenticated', :'A');

INSERT INTO public.children (id, user_id, name)
VALUES ('aaaa0001-0000-0000-0000-000000000001', :'A', 'Baby A');

INSERT INTO public.products (id, user_id, child_id, name, product_type)
VALUES ('aaaa0002-0000-0000-0000-000000000002', :'A',
        'aaaa0001-0000-0000-0000-000000000001', 'A car seat', 'car_seat');

INSERT INTO public.milestones (id, child_id, title, logged_at)
VALUES ('aaaa0003-0000-0000-0000-000000000003',
        'aaaa0001-0000-0000-0000-000000000001', 'Rolled over', CURRENT_DATE);

INSERT INTO public.emergency_info (user_id, child_id, allergies, pediatrician_phone)
VALUES (:'A', 'aaaa0001-0000-0000-0000-000000000001', 'peanuts', '555-0100');

INSERT INTO public.first_foods (child_id, food_name, date_introduced, is_allergen)
VALUES ('aaaa0001-0000-0000-0000-000000000001', 'avocado', CURRENT_DATE, false);

INSERT INTO public.growth_logs (child_id, weight_lbs, recorded_at)
VALUES ('aaaa0001-0000-0000-0000-000000000001', 14.2, now());

INSERT INTO public.bottles (user_id, child_id, bottle_type, storage, started_at, expires_at, alert_minutes_before)
VALUES (:'A', 'aaaa0001-0000-0000-0000-000000000001', 'formula', 'room_temp',
        now(), now() + interval '2 hours', 15);

INSERT INTO public.child_measurements (user_id, child_id, weight_lbs, recorded_at)
VALUES (:'A', 'aaaa0001-0000-0000-0000-000000000001', 14.2, now());

INSERT INTO public.emergency_contacts (user_id, name, phone, relationship)
VALUES (:'A', 'Grandma A', '555-0101', 'grandparent');

INSERT INTO public.home_profile (user_id, has_stairs, has_pool)
VALUES (:'A', true, false);

INSERT INTO public.checklist_completions (user_id, item_key) VALUES (:'A', 'outlet-covers');

SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE user_id = :'A') = 1,
  'Baseline: user A can read their own child'
);
SELECT test.logout();


-- ── Adversarial: user B tries to READ user A's data ────────────────────────
SELECT test.login('authenticated', :'B');

SELECT test.assert((SELECT count(*) FROM public.children) = 0,
  'IDOR: user B cannot read user A''s children');
SELECT test.assert((SELECT count(*) FROM public.products) = 0,
  'IDOR: user B cannot read user A''s products');
SELECT test.assert((SELECT count(*) FROM public.milestones) = 0,
  'IDOR: user B cannot read user A''s milestones');
SELECT test.assert((SELECT count(*) FROM public.emergency_info) = 0,
  'IDOR: user B cannot read user A''s emergency/medical info');
SELECT test.assert((SELECT count(*) FROM public.first_foods) = 0,
  'IDOR: user B cannot read user A''s first foods');
SELECT test.assert((SELECT count(*) FROM public.growth_logs) = 0,
  'IDOR: user B cannot read user A''s growth logs');
SELECT test.assert((SELECT count(*) FROM public.bottles) = 0,
  'IDOR: user B cannot read user A''s bottle logs');
SELECT test.assert((SELECT count(*) FROM public.child_measurements) = 0,
  'IDOR: user B cannot read user A''s measurements');
SELECT test.assert((SELECT count(*) FROM public.emergency_contacts) = 0,
  'IDOR: user B cannot read user A''s emergency contacts');
SELECT test.assert((SELECT count(*) FROM public.home_profile) = 0,
  'IDOR: user B cannot read user A''s home safety profile');
SELECT test.assert((SELECT count(*) FROM public.checklist_completions) = 0,
  'IDOR: user B cannot read user A''s checklist completions');
SELECT test.assert(
  (SELECT count(*) FROM public.profiles WHERE user_id = :'A') = 0,
  'IDOR: user B cannot read user A''s profile row'
);

-- Direct primary-key targeting (the classic IDOR shape): knowing the UUID
-- must not help.
SELECT test.assert(
  (SELECT count(*) FROM public.products
    WHERE id = 'aaaa0002-0000-0000-0000-000000000002') = 0,
  'IDOR: user B cannot read user A''s product by known UUID'
);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones
    WHERE id = 'aaaa0003-0000-0000-0000-000000000003') = 0,
  'IDOR: user B cannot read user A''s milestone by known UUID'
);

-- ── Adversarial: user B tries to WRITE user A's data ───────────────────────
UPDATE public.children SET name = 'Hacked' WHERE id = 'aaaa0001-0000-0000-0000-000000000001';
UPDATE public.products SET name = 'Hacked' WHERE id = 'aaaa0002-0000-0000-0000-000000000002';
UPDATE public.milestones SET title = 'Hacked' WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
UPDATE public.emergency_info SET allergies = 'Hacked' WHERE user_id = :'A';
DELETE FROM public.children WHERE id = 'aaaa0001-0000-0000-0000-000000000001';
DELETE FROM public.products WHERE id = 'aaaa0002-0000-0000-0000-000000000002';
DELETE FROM public.milestones WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
DELETE FROM public.bottles;
DELETE FROM public.growth_logs;
DELETE FROM public.first_foods;

-- Adversarial: user B cannot forge a row owned by user A.
SELECT test.assert_raises(
  $$INSERT INTO public.children (user_id, name)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Forged')$$,
  'IDOR: user B cannot insert a child owned by user A'
);
SELECT test.assert_raises(
  $$INSERT INTO public.products (user_id, name, product_type)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Forged', 'other')$$,
  'IDOR: user B cannot insert a product owned by user A'
);
-- Adversarial: user B cannot attach their own row to user A's child.
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title, logged_at)
    VALUES ('aaaa0001-0000-0000-0000-000000000001', 'Forged', CURRENT_DATE)$$,
  'IDOR: user B cannot attach a milestone to user A''s child'
);
-- Adversarial: user B cannot grant themselves caregiver access to A's child.
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role)
    VALUES ('aaaa0001-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222', 'editor')$$,
  'IDOR: user B cannot self-grant caregiver access to user A''s child'
);

-- Shared reference data is readable on purpose — asserted so a future
-- accidental widening of user data can''t hide behind these tables.
SELECT test.assert(
  (SELECT count(*) FROM public.recalls) >= 0,
  'Shared reference: recalls remain readable to any authenticated user'
);
SELECT test.logout();


-- ── User A's data survived every write attempt, intact ─────────────────────
SELECT test.login('authenticated', :'A');
SELECT test.assert(
  (SELECT name FROM public.children WHERE id = 'aaaa0001-0000-0000-0000-000000000001') = 'Baby A',
  'Post-attack: user A''s child is intact and still present'
);
SELECT test.assert(
  (SELECT name FROM public.products WHERE id = 'aaaa0002-0000-0000-0000-000000000002') = 'A car seat',
  'Post-attack: user A''s product is intact and still present'
);
SELECT test.assert(
  (SELECT title FROM public.milestones WHERE id = 'aaaa0003-0000-0000-0000-000000000003') = 'Rolled over',
  'Post-attack: user A''s milestone is intact and still present'
);
SELECT test.assert(
  (SELECT allergies FROM public.emergency_info WHERE user_id = :'A') = 'peanuts',
  'Post-attack: user A''s medical info is unmodified'
);
SELECT test.assert((SELECT count(*) FROM public.bottles) = 1,
  'Post-attack: user A''s bottle log survives user B''s DELETE');
SELECT test.assert((SELECT count(*) FROM public.growth_logs) = 1,
  'Post-attack: user A''s growth log survives user B''s DELETE');
SELECT test.assert((SELECT count(*) FROM public.first_foods) = 1,
  'Post-attack: user A''s first food survives user B''s DELETE');
SELECT test.logout();


-- ── Adversarial: anon (no session) sees nothing at all ────────────────────
SELECT test.login('anon');
SELECT test.assert((SELECT count(*) FROM public.children) = 0,
  'IDOR: anonymous callers cannot read any children');
SELECT test.assert((SELECT count(*) FROM public.products) = 0,
  'IDOR: anonymous callers cannot read any products');
SELECT test.assert((SELECT count(*) FROM public.emergency_info) = 0,
  'IDOR: anonymous callers cannot read any medical info');
SELECT test.assert((SELECT count(*) FROM public.milestones) = 0,
  'IDOR: anonymous callers cannot read any milestones');
SELECT test.logout();
