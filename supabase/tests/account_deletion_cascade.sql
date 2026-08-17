-- Verifies the specific claim in the Privacy Policy (src/lib/privacy-policy.ts,
-- Section 4/5): "If you delete your account... all of your personal data is
-- permanently deleted from our database immediately." deleteMyAccount
-- (src/utils/deleteAccount.functions.ts) implements this entirely via
-- Supabase's admin.deleteUser(), which is documented in that file's own
-- comment as relying on every table's `user_id`/`child_id` FK having
-- ON DELETE CASCADE — this test proves that chain actually holds by
-- deleting the auth.users row directly (the same underlying operation) and
-- asserting every table that stores personal data about this user or their
-- child is empty afterward, across both direct user_id FKs and transitive
-- ones (auth.users -> children -> milestones/first_foods).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('e1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');

INSERT INTO public.children (id, user_id, name, date_of_birth)
  VALUES ('e2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Baby E', '2026-01-01');

INSERT INTO public.products (id, user_id, child_id, name)
  VALUES ('e3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'Test Crib');

-- milestones has no user_id column at all — only reachable transitively
-- via children.
INSERT INTO public.milestones (child_id, title)
  VALUES ('e2222222-2222-2222-2222-222222222222', 'Rolled over');

INSERT INTO public.emergency_info (user_id, child_id, allergies, medications, blood_type, pediatrician_name, pediatrician_phone, emergency_contact_name, emergency_contact_phone)
  VALUES ('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222',
          'Peanuts', 'None', 'O+', 'Dr. Smith', '555-111-2222', 'Grandma', '555-333-4444');

INSERT INTO public.first_foods (child_id, food_name, is_allergen, reaction_notes)
  VALUES ('e2222222-2222-2222-2222-222222222222', 'Peanut butter', true, 'Mild rash around mouth');

INSERT INTO public.bottles (user_id, child_id, bottle_type, storage, expires_at)
  VALUES ('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'formula_prepared', 'fridge', now() + interval '2 hours');

INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES ('e1111111-1111-1111-1111-111111111111', 'https://push.example.com/e1', 'p256dh-key', 'auth-key');

INSERT INTO public.home_profile (user_id, has_stairs, home_type)
  VALUES ('e1111111-1111-1111-1111-111111111111', true, 'apartment');

SELECT test.logout();

-- Sanity check: every row actually exists before deletion (a false
-- pass on the assertions below could otherwise just mean the inserts
-- silently failed, not that cascade worked).
DO $$
BEGIN
  PERFORM test.assert(
    (SELECT count(*) FROM public.children WHERE id = 'e2222222-2222-2222-2222-222222222222') = 1,
    'sanity: child row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.products WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 1,
    'sanity: product row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.milestones WHERE child_id = 'e2222222-2222-2222-2222-222222222222') = 1,
    'sanity: milestone row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.emergency_info WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 1,
    'sanity: emergency_info row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.first_foods WHERE child_id = 'e2222222-2222-2222-2222-222222222222') = 1,
    'sanity: first_foods row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.bottles WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 1,
    'sanity: bottles row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.web_push_subscriptions WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 1,
    'sanity: web_push_subscriptions row exists before deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.home_profile WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 1,
    'sanity: home_profile row exists before deletion'
  );
END $$;

-- The actual operation: deleteMyAccount ultimately calls
-- supabase.auth.admin.deleteUser(userId), which deletes this row.
DELETE FROM auth.users WHERE id = 'e1111111-1111-1111-1111-111111111111';

DO $$
BEGIN
  PERFORM test.assert(
    (SELECT count(*) FROM public.children WHERE id = 'e2222222-2222-2222-2222-222222222222') = 0,
    'children row is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.products WHERE id = 'e3333333-3333-3333-3333-333333333333') = 0,
    'products row is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.milestones WHERE child_id = 'e2222222-2222-2222-2222-222222222222') = 0,
    'milestones row (only reachable transitively via children) is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.emergency_info WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 0,
    'emergency_info row (allergies/medications/blood type/emergency contact) is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.first_foods WHERE child_id = 'e2222222-2222-2222-2222-222222222222') = 0,
    'first_foods row (allergen/reaction data) is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.bottles WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 0,
    'bottles row is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.web_push_subscriptions WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 0,
    'web_push_subscriptions row (push device identifiers) is gone after account deletion'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.home_profile WHERE user_id = 'e1111111-1111-1111-1111-111111111111') = 0,
    'home_profile row is gone after account deletion'
  );
END $$;
