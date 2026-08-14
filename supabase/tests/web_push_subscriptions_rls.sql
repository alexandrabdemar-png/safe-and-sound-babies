-- Adversarial RLS tests for web_push_subscriptions (migration 20260814120000).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ── Owner can insert and read their own subscription ────────────────────────
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example/a', 'p256dh-a', 'auth-a');
SELECT test.assert(
  (SELECT count(*) FROM public.web_push_subscriptions
    WHERE endpoint = 'https://push.example/a') = 1,
  'Owner can insert and see their own subscription'
);

-- Adversarial: user A cannot insert a subscription claiming to belong to user B.
SELECT test.assert_raises(
  $$INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://push.example/spoof', 'p', 'a')$$,
  'Adversarial: user A cannot insert a subscription owned by user B'
);
SELECT test.logout();

-- ── Adversarial: unrelated user B cannot see or modify user A's subscription ──
SELECT test.login('authenticated', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT test.assert(
  (SELECT count(*) FROM public.web_push_subscriptions
    WHERE endpoint = 'https://push.example/a') = 0,
  'Adversarial: unrelated user B cannot see user A''s subscription'
);

UPDATE public.web_push_subscriptions SET p256dh = 'hacked' WHERE endpoint = 'https://push.example/a';
SELECT test.assert(
  (SELECT count(*) FROM public.web_push_subscriptions WHERE p256dh = 'hacked') = 0,
  'Adversarial: user B''s UPDATE of user A''s subscription affected 0 rows'
);

DELETE FROM public.web_push_subscriptions WHERE endpoint = 'https://push.example/a';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.web_push_subscriptions WHERE endpoint = 'https://push.example/a') = 1,
  'Adversarial: user B''s DELETE affected 0 rows — user A''s subscription survives'
);
SELECT test.logout();

-- ── Adversarial: anon has no grant on this table at all ─────────────────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$SELECT * FROM public.web_push_subscriptions$$,
  'Adversarial: anon cannot view web push subscriptions (no table grant)'
);
SELECT test.logout();

-- ── Owner can delete their own subscription (unsubscribe) ───────────────────
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
DELETE FROM public.web_push_subscriptions WHERE endpoint = 'https://push.example/a';
SELECT test.assert(
  (SELECT count(*) FROM public.web_push_subscriptions WHERE endpoint = 'https://push.example/a') = 0,
  'Owner can delete (unsubscribe) their own subscription'
);
SELECT test.logout();

-- ── Endpoint uniqueness is enforced (re-subscribe from same browser upserts) ─
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example/unique', 'p', 'a');
SELECT test.assert_raises(
  $$INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://push.example/unique', 'p2', 'a2')$$,
  'Adversarial: duplicate endpoint is rejected by the UNIQUE constraint (client should upsert instead)'
);
SELECT test.logout();
