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

## 7. Subscriptions — highest-risk item
Current implementation is **Stripe web checkout** (embedded checkout + Stripe billing
portal) for a $3.33/month Pro plan with a 7-day trial, inside a Capacitor shell that
loads the hosted site.

Gaps:
- **Blocker for public App Store release, and a likely problem for external TestFlight
  beta review:** unlocking in-app digital features must go through Apple In-App
  Purchase on iOS. There is no StoreKit integration, no "Restore purchases", and no
  App Store Connect subscription product. Options to review: implement StoreKit IAP
  for iOS (keeping Stripe for web), or ship iOS as free-only with no purchase surface
  and no links out to a web paywall. **[counsel]** on the reader/multiplatform-app
  exception if you believe one applies.
- Pricing screen lacks Terms/EULA + Privacy links (see §5).
- Entitlement logic is centralized and consistent (`src/lib/isPro.ts` used by both the
  client hook and the server gate) — good.
- Product-facing concern: **data export is Pro-gated.** If a user's ability to get their
  own data out sits behind a paywall, that is worth reviewing both as a review-risk and
  a data-rights question **[counsel]**. Account deletion is correctly free.
- Internal TestFlight (up to 100 team testers) needs no review, so the IAP gap does not
  block getting a build to testers now.

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
3. Add Terms/EULA + Privacy links and full renewal terms to the pricing screen.
4. Decide the iOS purchase posture (§7) — at minimum, hide the paywall in the iOS build
   until StoreKit exists, so reviewers do not see a non-IAP purchase flow.
5. Run TESTFLIGHT_CHECKLIST.md end to end on a device.

**Before public App Store submission**
6. Implement StoreKit IAP + Restore Purchases for iOS, or ship iOS free-only. **[counsel]**
7. Complete the App Privacy questionnaire to match the policy; confirm age rating and the
   not-child-directed answer. **[counsel]**
8. Extend the safety/medical disclaimer to every advisory surface; label AI results.
9. Ungate data export, or document why it is Pro-only. **[counsel]**
10. Decide whether Terms re-consent on material changes is required, and adjust the
    one-time gate accordingly. **[counsel]**
11. Drop the unused `children.due_date` column.
12. Add rate limiting to emergency-share token lookups and AI search.
