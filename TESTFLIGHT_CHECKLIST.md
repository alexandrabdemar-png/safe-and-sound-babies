# TestFlight QA checklist — Peace of Mine

Run this on a physical iPhone against a TestFlight build. Test each row with a
**fresh account** (Gmail plus-aliases: `you+parent@`, `you+ped@`, …) so onboarding
paths are exercised from zero.

## 0. Build / config preflight
- [ ] `bun run ios:sync` run after the last web change; build number bumped.
- [ ] `capacitor.config.ts` `server.url` points at the intended host (prod vs preview).
- [ ] Backend secrets present: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`, `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT=sandbox`. **Currently the three key secrets are NOT set — iOS push will silently no-op until they are.**
- [ ] Apple + Google auth providers enabled in the backend auth config (otherwise "Unsupported provider").
- [ ] Xcode: Push Notifications + Background Modes → Remote notifications capabilities added.

## 1. Account creation & auth
- [ ] Email + password signup (8+ chars); weak password shows friendly error.
- [ ] Sign in with Apple works and returns to the app signed in.
- [ ] Sign in with Google works.
- [ ] Magic link works.
- [ ] Wrong password / unknown email → friendly, non-leaky error.
- [ ] Sign out, then relaunch → still signed out.
- [ ] Force-quit while signed in, relaunch → session restored, no auth flash.

## 2. Legal consent gate
- [ ] New user is routed to `/legal-consent` before any authenticated screen.
- [ ] Cannot continue without both consent checkboxes + 18-or-older confirmation.
- [ ] Terms and Privacy links open readable full text.
- [ ] After accepting, gate never reappears (sign out/in, relaunch, new device).

## 3. Onboarding (per profile type)
- [ ] Parent: baby's name only, category picks saved.
- [ ] Parent-to-be: completes without a birthdate.
- [ ] Pediatrician / Daycare / Nanny / Caregiver: age-range flow, no child created, lands on a usable screen (not an onboarding loop).
- [ ] Kill the app mid-onboarding → progress restored.
- [ ] "Skip" paths do not leave a broken/empty Home.

## 4. Products & recalls (core value)
- [ ] Barcode scan: camera permission prompt shows the expected copy; scan resolves a product.
- [ ] Deny camera permission → clear explanation, manual entry still available.
- [ ] Manual product add works; invalid barcode rejected with a readable message.
- [ ] AI product search returns results; a 100+ char query is rejected gracefully.
- [ ] Product detail shows recall status, source name, and "data as of" date.
- [ ] Recall Radar / Alerts screens load with 0 items and with items.
- [ ] Age-appropriateness banner appears for a too-early category.
- [ ] Airplane mode → offline banner appears; no crash; recovers on reconnect.

## 5. Notifications
- [ ] First push prompt appears at a sensible moment with context.
- [ ] Decline permission → app fully usable, no repeated nagging.
- [ ] Accept → device token stored; test recall push arrives.
- [ ] Tapping a recall push deep-links to `/alerts`.
- [ ] Notification Settings: pause/quiet window and advance-days changes persist.

## 6. Tracking features
- [ ] Add a moment/milestone (Pro gate behaves as designed).
- [ ] Bottles: create, expiry countdown correct, alert fires.
- [ ] First foods: add allergen, reaction notes saved.
- [ ] Checklists (homecoming, travel) persist completion.
- [ ] Emergency info saves; share link opens in a private window and shows only that child.
- [ ] Caregiver invite: send, accept on a second account, then revoke → access gone.

## 7. Subscription
- [ ] Pricing screen shows price, billing period, trial length, and renewal wording.
- [ ] Purchase path completes (see COMPLIANCE_REPORT.md §7 — the current Stripe web flow is the main App Store risk).
- [ ] Manage/cancel path reachable; cancelled-but-in-period user keeps Pro until period end.
- [ ] Pro features lock again after the period ends.
- [ ] Sandbox/test-mode banner is NOT visible in a build intended for testers.

## 8. Deletion & export
- [ ] Delete a child → its milestones/alerts gone, account intact.
- [ ] Export my data returns a file with the expected contents.
- [ ] Delete my account: two-step confirm, subscription cancelled, photos removed, sign-in with the same email creates a brand-new empty account.

## 9. Stability / polish
- [ ] No crash on cold start, backgrounding, or rotation on iPhone SE and Pro Max sizes.
- [ ] Dynamic Type at largest accessible size: no clipped/unreachable buttons.
- [ ] Dark mode (if supported) has no unreadable text.
- [ ] VoiceOver can reach the primary action on Home, Scan, Alerts, Profile.
- [ ] Every tab-bar destination and every Profile link resolves (no 404 / blank route).
- [ ] Safety/medical disclaimer visible where guidance is shown.
- [ ] Privacy Policy and Terms reachable in-app without an account (public routes) and from Profile.
