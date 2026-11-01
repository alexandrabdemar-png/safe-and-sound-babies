# Apple review follow-up — Guideline 2.1(a), email sign-in hangs (November 1, 2026)

## Root cause

On a fresh install (exactly how App Review tests), email sign-in and account creation spun forever. The app’s saved-login code returned a native Capacitor plugin object from an async function. Capacitor plugin objects answer *every* property, including `then`, so JavaScript treated the object as a promise and waited for a native `then` call that never answers. Supabase reads that saved login while it starts up, so every email sign-in and sign-up request waited on that read forever. Devices that already had a saved login usually skipped that read, which is why it didn’t show up in our own testing.

## Fix

- The Keychain and Preferences helpers now return plain wrapper objects, never the plugin itself.
- Every native storage call gives up after 3 seconds, and the signed-in check stops waiting on the session restore after 6 seconds, so a native call can’t freeze the app again.
- The email form stops its spinner and shows a message if a request takes longer than 25 seconds.
- A new regression test reproduces the hang with a Capacitor-shaped plugin. It fails on the old code and passes on the new code.

## Follow-up hardening (audit fixes)

- **Signup goes straight to onboarding.** The auth listener no longer races the form's own navigation.
- **`/onboarding` can't hang.** Its Terms check now gives up after 8 seconds, like the other signed-in screens.
- **Every Supabase auth request has a 20-second limit**, and each request is logged. Database, storage and edge-function requests are unchanged.
- **Pre-build check:** `bun run ios:sync` now also fails if the Keychain (`NativeBiometricPlugin`) or Preferences (`PreferencesPlugin`) plugin isn't registered.
- **Hidden sign-in diagnostics screen.** On the sign-in screen, tap the sparkle icon above "Welcome back" **five times quickly**. The screen shows:
  - auth events, and each auth request with its status code and duration
  - timeouts and errors
  - device details
  - a **Test connection** button and a **Copy report** button

  It never records passwords, tokens or email addresses. If sign-in fails on a device, send that report.

## Before resubmitting

1. **Publish in Lovable.** The fix is in the hosted app, so a new binary isn’t required.
2. On an iPhone **and an iPad**, delete the app, reinstall it from TestFlight, then create a new account with email, sign out, and sign back in with email. Also test with the App Review demo account.
3. Reply to App Review: “We fixed an issue where email sign-in and account creation could load indefinitely on a fresh install. The fix is live. Please try again with the demo account.”

# Apple review follow-up — build 24 (October 21, 2026)

## Root cause found for "unable to purchase subscription"

Every Apple purchase failed after the App Store sheet completed: saving the purchase hit a database error ("no unique or exclusion constraint matching the ON CONFLICT specification"), so the app showed an error and Pro never unlocked. No Apple purchase had ever been recorded. Fixed on October 21, 2026. Also fixed: an App Review/TestFlight (sandbox) purchase now unlocks Pro in the production app.

This fix is on the hosted site, so **publish in Lovable** before the next review. A new binary is not required for this fix, but uploading build 25 is fine. Also confirm the Paid Apps Agreement shows **Active** (it was Processing on Oct 18).

# Earlier follow-up — build 22 (October 18, 2026)

Apple’s current rejection is Guideline 2.1(b): the monthly and annual in-app purchases could not be found in the submitted app. The screenshot shows both subscriptions already included in the submission as Ready for Review. Do not remove them; they are intended to be available.

## App-side changes

- The purchase screen now requires the actual selected StoreKit product before enabling purchase. It no longer hides lookup failures behind a hardcoded price.
- Missing Apple purchase code in an old binary now produces a visible update message. Other StoreKit lookup failures are visible and can be retried.
- Monthly uses `monthlyplan`; annual uses `annualplan`. Both options remain selectable on iOS.
- `bun run ios:sync` now checks the generated iOS plugin registration, native dependency, app identifier, and installed product IDs before you archive.

These changes do not establish why build 22 failed. The rejected archive is on your Mac / App Store Connect, not in this project. The preflight does not prove that Xcode successfully links an archive or that Apple returns products.

## Complete on your Mac and in App Store Connect

1. Publish the updated hosted app in Lovable, then pull the latest project on your Mac. The iPhone app loads the published site, not this preview.
2. From `~/Developer/safe-and-sound-babies`, run:

   ```bash
   bun install
   bun run ios:sync
   bun run ios:open
   ```

   Stop if sync or the Apple purchase preflight fails. Do not archive a failed sync.
3. In Xcode, select the App target. Verify its bundle identifier is `com.peaceofmine.baby`, the correct Apple developer Team is selected, and In-App Purchase is present under Signing & Capabilities. For SPM, ensure AppleIap resolves in the package dependencies; for CocoaPods, open the workspace and ensure AppleIAP is installed. Build with a number higher than 22 and upload it to TestFlight.
4. In App Store Connect, verify both subscriptions’ **Product IDs**, not just their display names: `monthlyplan` and `annualplan`. Check duration, prices ($3.39/month and $34.99/year for the US), introductory offers, availability in the test storefront, complete metadata and review screenshots. Confirm the Paid Apps Agreement and banking/tax setup are active. Do not claim a free trial unless the corresponding introductory offer is configured in Apple.
5. Test the newly uploaded build on a physical iPhone, using the exact demo account supplied to App Review. Open **Profile → Upgrade to Pro**. Select Monthly, then Yearly; each must load its App Store price. A price or error message alone is not a successful purchase test.
6. Complete a sandbox purchase and confirm Pro features unlock. Exercise both plan purchase paths, Restore purchases, and Manage subscription. Use separate free demo/test accounts or reset sandbox purchase history when necessary; an already-subscribed account may only see subscription management.
7. If a lookup fails, send the exact on-screen error and a screenshot of the subscription’s Product ID/status. If a purchase succeeds at Apple but Pro does not unlock, send that verification error instead. Those are different failures.

## Required recording and resubmission

Apple explicitly requires a recording captured on a **physical device**:

- Start at the iPhone Home Screen and launch the new build.
- Use the demo account listed in App Review Information.
- Show core app features and the route to Profile → Upgrade to Pro.
- Show both subscription options and the actual successful sandbox purchase flow(s), with Pro unlocking afterward.
- Demonstrate other purchase access paths, restore, and subscription management.

Attach the recording to App Review Information (use an accessible recording link in Notes if necessary), select the new build, and include both subscription products alongside it. The screenshot currently shows Ready for Review; if a product later becomes Rejected, correct it and resubmit it with the app as Apple requested. Verify the demo account is not already Pro when reviewers begin.

Do not resubmit until the purchase works on the actual new TestFlight build. A simulated browser, successful automated test, or saved backend secrets cannot substitute for this recording.

## Suggested review note — use only after the device tests pass

“We have uploaded build [new number] and included both auto-renewable subscriptions: monthlyplan (monthly) and annualplan (annual). To access purchases, sign in with the supplied demo account, open Profile, and select Upgrade to Pro. Both plans use Apple StoreKit. We verified successful sandbox purchases and Pro access on a physical iPhone using the new build. The attached recording starts at the iPhone Home Screen and demonstrates the core features and purchase flows. Recording: [link].”