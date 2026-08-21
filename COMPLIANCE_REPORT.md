# App Store / TestFlight readiness audit — Peace of Mine

Date: 2026-08-20. Scope: technical and product gaps to review before TestFlight
(internal → external) and public App Store submission.

**Not legal advice.** Nothing here is a legal conclusion about COPPA, GDPR, CCPA,
HIPAA, or App Store outcomes. Items marked **[counsel]** are decisions to take to
a lawyer with the facts documented below.

Stated data boundary confirmed in code: the app does **not** collect or store child
date of birth, height, or weight. `children.date_of_birth`, `height_inches`,
`weight_lbs` were purged (`supabase/migrations/20260818000000_purge_child_birthdate_and_measurements.sql`)
and no application code reads them. `children.due_date` still exists as a column but
is not written or read by any UI code — dead column, recommend dropping it so the
"we don't store birth dates" claim is structurally true.

---

## 1. Account creation
Implemented: email+password (8-char minimum, friendly errors), magic link, Sign in
with Google, Sign in with Apple (`src/routes/auth.tsx` via the Lovable auth broker).
No anonymous accounts. Sign in with Apple is present, which matters because a
third-party social login is offered.

Gaps:
- Verify the Apple and Google providers are actually enabled in the backend auth
  config before a tester build; otherwise first tap fails with "Unsupported provider".
- No email-verification requirement before use. Decide whether that is acceptable
  for an app holding child names and emergency medical info.

## 2. Age of the account holder
Implemented: `/legal-consent` requires an explicit "I am 18 or older" attestation
plus separate Terms and Privacy consent, recorded in `user_agreements` with a
version (`CURRENT_TERMS_VERSION = 2026-08-13`). The gate runs in
`src/routes/_authenticated/route.tsx` before any authenticated screen.

Gaps / **[counsel]**:
- Attestation only; no neutral age gate or DOB collection. Confirm this is the
  posture you want for the chosen App Store age rating and for the child-directed
  question below.
- App Store Connect age rating and the "Made for Kids"/Kids Category answer must be
  consistent with "app for adults about children" — the app is parent-facing, not
  child-directed, and collects no child DOB. Document that reasoning.
- The consent gate is one-time by design (`needsLegalConsent` returns true only when
  the user has *no* recorded acceptance). A future material Terms change will **not**
  re-prompt existing users. If re-consent matters, that logic must change.

## 3. Child-related data
Collected: child first name (free text, 80-char cap), milestones/moments (title,
notes, optional photo), first foods incl. allergens and reaction notes, bottle logs,
emergency info (allergies, medications, blood type, pediatrician name/phone,
emergency contact), tracked products.

Notes / **[counsel]**:
- Emergency info is health data about a minor. It is the app's most sensitive store.
  It is RLS-scoped to the owner plus explicitly granted caregivers, and share links
  are SHA-256 hashed tokens with expiry/revocation. Confirm whether your
  jurisdictions treat this as special-category data needing extra disclosure or
  consent language.
- Emergency share links have no rate limiting on token guessing (tokens are
  high-entropy, so this is low risk, but it is an open item from
  `SECURITY_ASSESSMENT.md`).
- Photos are in a private bucket, owner-folder-scoped, and deleted with the account.

## 4. Privacy policy
`src/lib/privacy-policy.ts`, reachable publicly at `/privacy-policy` and in-app at
Profile → Privacy Policy. It is unusually complete: per-category collection, the
explicit "what we do NOT collect" list, named sub-processors (Resend, Stripe,
Google/Gemini via the AI gateway, Apple/APNs, browser push services), named recall
sources, 7-day backup/log retention window, deletion mechanics, children's-privacy
section, admin access restrictions.

Gaps:
- Fixed this pass: the policy said feedback lives only as email, but feedback is also
  stored in `public.feedback` with `user_id` set to NULL on account deletion (message
  text survives). Policy now states this.
- App Store Connect **App Privacy** questionnaire must be filled to match this policy
  (data types: name, email, photos, health-ish info, purchases, identifiers; linked to
  user; not used for tracking). Nothing in the app tracks across apps — no analytics or
  ad SDKs are installed (verified: no Firebase/Sentry/PostHog/AdMob/ATT usage; the
  `NSUserTrackingUsageDescription` string exists but no ATT prompt is triggered).
- Add a policy "last updated" changelog note when the version changes, and confirm the
  hosted URL you enter in App Store Connect is the public `/privacy-policy` route.

## 5. Terms of service
`/terms` exists publicly, includes a liability/assumption-of-risk section and the
safety disclaimer. Fixed this pass: Terms had **no in-app link from Profile** — added.

Gaps:
- The paid-subscription screen does not link Terms/EULA and Privacy. Apple expects both
  links plus price, billing period, and renewal terms on/adjacent to the purchase screen.
- **[counsel]** Auto-renewal disclosure wording, refund policy, and governing-law clause
  against Apple's standard EULA if you rely on it.

## 6. Safety content and source attribution
Recall data is read from CPSC, NHTSA + data.transportation.gov, USDA FSIS, Health
Canada, EU Safety Gate (`supabase/functions/_shared/allRecallSources.ts`). Each recall
row stores `source` and `url`; `DataAsOf` surfaces freshness; `PediatricianDisclaimer`
is rendered on Safety Guides.

Gaps:
- The disclaimer component is used on **one** screen. Guidance-bearing surfaces
  (Home "Up next" insights, Daily Discovery, safety tips, age-appropriateness banners,
  checklists) show advisory content without it. Recommend a compact disclaimer or a
  persistent footer link on every advisory surface — this is also what reviewers look
  for on health-adjacent content.
- AI-generated product search results are model output; label them as unverified
  suggestions where shown.
- "Possible recall match" states should always name the source and link out, so a
  parent can verify with the government notice.

## 7. Subscriptions — updated 2026-08-21
Implementation is now **dual-path**: Stripe embedded checkout + billing portal on the
web, and native Apple In-App Purchase (StoreKit 2) on iOS, for the same $3.33/month
Pro plan with a 7-day trial. `src/routes/_authenticated/pricing.tsx` picks between
them based on platform (`useIsNativeIOS`) — the web build's Stripe flow is unchanged.

What was added for iOS:
- `packages/apple-iap/` — a local Capacitor plugin wrapping StoreKit 2 (`getProduct`,
  `purchase`, `restorePurchases`, plus a `transactionUpdate` listener for renewals).
  See its own README.md for full setup.
- `src/lib/appleIap.server.ts` / `src/utils/appleIap.functions.ts` — every purchase and
  restored transaction is re-verified server-side against Apple's App Store Server API
  (`@apple/app-store-server-library`, Apple's own official library) before Pro is
  granted; a client-reported "purchase succeeded" is never trusted on its own.
- `src/routes/api/public/payments/apple-webhook.ts` — receives App Store Server
  Notifications V2 (renewals, refunds, cancellations) and keeps `subscriptions` in
  sync, mirroring the existing Stripe webhook's role.
- `subscriptions` gained `payment_provider`, `apple_original_transaction_id`,
  `apple_transaction_id` columns (migration `20260821204030_...sql`) — `computeIsPro`/
  `useSubscription` needed no changes, since Apple-originated rows are written in the
  exact same shape Stripe rows already used.
- A "Restore purchases" control is present (Apple requires this for any IAP app).

Gaps still open:
- **Requires your own App Store Connect setup before this can be tested at all** — an
  actual subscription product, an In-App Purchase API key, the App Store Server
  Notifications webhook URL, and 5 new backend secrets
  (`APPLE_IAP_KEY_ID`/`APPLE_IAP_ISSUER_ID`/`APPLE_IAP_PRIVATE_KEY`/
  `APPLE_IAP_BUNDLE_ID`/`APPLE_IAP_APP_APPLE_ID`). None of this can be done from a dev
  environment — see `packages/apple-iap/README.md`'s "App Store Connect setup" section
  for the exact steps.
- **Untested end-to-end** — StoreKit purchases cannot be verified without a real (or
  sandbox) App Store Connect product actually configured; only the pure data-mapping
  logic (`transactionToSubscriptionRow`) has automated test coverage. Run
  `packages/apple-iap/README.md`'s testing checklist on a real device before trusting
  this in front of testers.
- Pricing screen now has Terms/EULA + Privacy links and renewal disclosure (was
  missing, see §5) — done.
- Terms of Service gained a Subscriptions & Billing section (was entirely absent) —
  see §5's note on whether this warrants forcing existing users to re-consent.
  **[counsel]**
- **[counsel]** Whether this custom subscriptions section is preferred over adopting
  Apple's Standard EULA wholesale (Apple explicitly allows the Standard EULA for an
  app with only auto-renewable subscriptions, which would replace needing custom
  auto-renewal wording at all).
- Entitlement logic is still centralized and consistent (`src/lib/isPro.ts` used by
  the client hook and the server gate) — good, and unaffected by this change.
- Product-facing concern: **data export is Pro-gated.** If a user's ability to get their
  own data out sits behind a paywall, that is worth reviewing both as a review-risk and
  a data-rights question **[counsel]**. Account deletion is correctly free.
- Internal TestFlight (up to 100 team testers) needs no review, so an incomplete Apple
  IAP setup does not block getting a build to testers now — but purchasing Pro on that
  build will fail until App Store Connect is actually configured.

## 8. Notifications
APNs push for recalls, expirations, and bottle alerts; web push via VAPID; in-app
toasts and realtime co-parent updates. Notification Settings screen supports pausing
and advance-days. Push payloads contain product names and recall counts — no child
names, no health details — which is the right default for a lock-screen.

Gaps:
- `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8` are **not set** as backend secrets, so
  iOS push does not deliver yet. Set them (plus `APNS_ENVIRONMENT=sandbox` for
  TestFlight) before promising push in the tester notes.
- No explanatory pre-prompt before the iOS permission dialog; consider one, since a
  denied prompt is effectively permanent and push is core to the value proposition.
- Alert-email delivery via Resend duplicates push content by email — confirm that is
  wanted, and that it is disclosed (it is, in §3 of the policy).

## 9. Analytics, ads, affiliates
None. No analytics/attribution/ad SDKs, no affiliate links, no sponsored content, no
IDFA/ATT usage. This makes the App Privacy questionnaire simple: no tracking.
If you later add any of these, they change the questionnaire and the policy.

## 10. Data deletion and export
- In-app account deletion exists (Profile → Our Privacy Promise → Delete my account),
  two-step confirm, cancels Stripe subscriptions, purges `product-photos` storage, then
  deletes the auth user so every FK cascades. This satisfies Apple's in-app account
  deletion requirement.
- Per-child deletion exists.
- Export exists but is Pro-gated (§7).
- Residual after deletion, all disclosed: feedback message text (user unlinked),
  shared product-catalog rows (no personal data), aggregate counts, and up to 7 days in
  encrypted backups.

## 11. Security posture (carried from SECURITY_ASSESSMENT.md)
RLS on all user tables, `anon` privileges revoked across 29 app tables, two-account
IDOR suite passing, webhook signature verification, PII redaction in logs, server-side
input length caps, authenticated AI search. Open: rate limiting on emergency-share
token attempts and on AI search cost abuse.

---

## Prioritized pre-launch checklist

**Before external TestFlight**
1. Set the three APNs secrets; verify a real push on device.
2. Enable Apple + Google auth providers; verify both sign-in buttons on device.
3. ~~Add Terms/EULA + Privacy links and full renewal terms to the pricing screen.~~ Done 2026-08-21.
4. ~~Decide the iOS purchase posture (§7)~~ Done 2026-08-21 — StoreKit IAP implemented
   for iOS (Stripe unchanged on web). **Still needed: the App Store Connect setup
   itself (subscription product, IAP key, webhook URL, 5 backend secrets) — see
   `packages/apple-iap/README.md`. Purchasing will fail on iOS until that's done.**
5. **New:** verify the `20260818000000_purge_child_birthdate_and_measurements.sql`
   migration has actually been applied to the live database — `src/integrations/
   supabase/types.ts` (regenerated 2026-08-19, after that migration was already
   committed) still lists the columns it's supposed to have dropped
   (`date_of_birth`, `due_date`, `birth_week`, `height_inches`, `weight_lbs`,
   `measurements_updated_at`), which is a strong sign the migration file exists but
   was never actually run. Run it via `supabase db push` or the SQL editor if so, then
   regenerate `types.ts`. The same applies to `20260818010000_drop_dead_sizeup_
   prediction_columns.sql` (`next_size_at`/`predicted_sizeup_date` also still appear).
   Until this is confirmed, "we don't store your child's birthdate" in the privacy
   policy may not yet be true for existing users' already-collected data, even though
   no app code writes to these columns anymore.
6. Run TESTFLIGHT_CHECKLIST.md end to end on a device.

**Before public App Store submission**
7. ~~Implement StoreKit IAP + Restore Purchases for iOS~~ Done 2026-08-21 (see §7) —
   remaining: the App Store Connect setup above, and end-to-end testing with a real
   sandbox purchase (untestable without it).
8. Complete the App Privacy questionnaire to match the policy; confirm age rating and the
   not-child-directed answer. Note the policy now also names Apple as a payment
   processor for iOS purchases — include purchase history in the data-types answer.
   **[counsel]**
9. Extend the safety/medical disclaimer to every advisory surface; label AI results.
10. Ungate data export, or document why it is Pro-only. **[counsel]**
11. Decide whether Terms re-consent on material changes is required, and adjust the
    one-time gate accordingly — directly relevant now that a real Subscriptions &
    Billing section was just added to Terms and existing users won't automatically
    see it (see `legalConsent.ts`'s `CURRENT_TERMS_VERSION` comment). **[counsel]**
12. Decide whether to keep the custom Subscriptions & Billing Terms section or adopt
    Apple's Standard EULA instead (Apple allows the Standard EULA for an app with only
    auto-renewable subscriptions). **[counsel]**
13. Add rate limiting to emergency-share token lookups and AI search.
