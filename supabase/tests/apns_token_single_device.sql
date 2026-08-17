-- Documents a real architectural limit surfaced by the "does data sync
-- across devices" audit: profiles.apns_device_token is a single scalar
-- column (see the 20260702000000 rename migration, plus profiles.user_id
-- being UNIQUE — one profile row per user), not a one-to-many device
-- table. usePushRegistration.ts (src/hooks/usePushRegistration.ts) writes
-- to it with a plain `.update({ apns_device_token }).eq("user_id", ...)`
-- on every app launch on every native device.
--
-- Net effect: if the same account is signed in on two native devices
-- (e.g. a parent's phone and a co-parent's, or a phone and a tablet), only
-- the most-recently-registered device's token survives — the other device
-- silently stops receiving native push notifications (including recall
-- alerts) with no error surfaced anywhere, since scheduled-recall-check
-- reads exactly one apns_device_token per user (index.ts line ~445).
--
-- Contrast: web_push_subscriptions (its own table, one row per browser
-- subscription) does NOT have this limitation — notify.ts's notifyUser
-- iterates every registered subscription independently. This test only
-- covers the native/APNs channel.
--
-- Not asserting this is wrong (a single active device may be an
-- intentional simplification) — just proving, with the real schema, that
-- registering a second device really does silently displace the first
-- one's ability to receive native push, so this is a known fact rather
-- than an assumption if it ever needs to change.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a9111111-1111-1111-1111-111111111111');

-- A profiles row is auto-created by an AFTER INSERT trigger on auth.users
-- (see 20260607212106's handle_new_user), so the first device registration
-- is an UPDATE, not an INSERT — same as the real usePushRegistration.ts
-- write.
SELECT test.login('service_role');
UPDATE public.profiles SET apns_device_token = 'device-token-phone-A'
  WHERE user_id = 'a9111111-1111-1111-1111-111111111111';
SELECT test.logout();

DO $$
BEGIN
  PERFORM test.assert(
    (SELECT apns_device_token FROM public.profiles WHERE user_id = 'a9111111-1111-1111-1111-111111111111') = 'device-token-phone-A',
    'first device registration is recorded'
  );
END $$;

-- Simulates a second device (e.g. a tablet, or the same phone re-installing
-- the app) registering for push — the exact write usePushRegistration.ts
-- performs.
SELECT test.login('service_role');
UPDATE public.profiles SET apns_device_token = 'device-token-tablet-B'
  WHERE user_id = 'a9111111-1111-1111-1111-111111111111';
SELECT test.logout();

DO $$
BEGIN
  PERFORM test.assert(
    (SELECT apns_device_token FROM public.profiles WHERE user_id = 'a9111111-1111-1111-1111-111111111111') = 'device-token-tablet-B',
    'second device registration overwrites the first — only one native device can receive push at a time'
  );
  PERFORM test.assert(
    (SELECT count(*) FROM public.profiles WHERE user_id = 'a9111111-1111-1111-1111-111111111111') = 1,
    'exactly one profiles row exists regardless of how many devices registered — confirms this is a single scalar column, not a per-device table'
  );
END $$;
