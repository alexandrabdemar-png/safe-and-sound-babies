# Apple review follow-up — Guideline 3.1.1, web checkout reachable in the app (November 18, 2026)

Submission 85c172fc-b98e-4e32-b6dc-79a5b1d6cc67, version 1.0 (25), reviewed on **iPad Air 11-inch (M3)**.

## Root cause

The app is a native shell that loads the hosted site. The site decides "App Store app → Apple In-App Purchase" or "web → Stripe" in the browser. On iPad, the in-app web view sends a **desktop Mac user agent**, and the fallback detection explicitly treated that as "not the app" (a unit test even asserted it). Whenever the Capacitor bridge signal wasn't available, the iPad was treated as a website and Plans offered Stripe checkout. The website header's "Pricing" link only appears at tablet width, so the website nav (Pricing / Sign in / Get started) was visible on iPad only.

## Fix (hosted site + new binary)

- Detection: the iPad app's desktop-style web view on a touch screen is now recognised as the app. Builds from now on also add `PeaceOfMineApp` to the user agent (`capacitor.config.ts` → `ios.appendUserAgent`), so detection doesn't rely on guesswork.
- Server backstop: `createCheckoutSession` and `createPortalSession` refuse requests that come from the App Store app, so Stripe checkout and the Stripe billing portal can't open there even if a client-side check misses.
- `StripeEmbeddedCheckout` refuses to render inside the app.
- `*.stripe.com` removed from the native web view's allowed navigation.
- The website marketing header is replaced by a plain logo bar inside the app.
- Free trial: in the app, "free trial" text appears only when StoreKit reports an introductory offer this Apple ID is eligible for (Guideline 3.1.2). Older binaries report none, so they show "Subscribe" with no trial claim.
- Pending (Ask to Buy) purchases show a "waiting for approval" message, not an error. Restore explains when the Apple ID's subscription belongs to another account.
- Profile → Manage opens Apple's subscription management for App Store subscribers (it used to show a toast only). Account deletion warns App Store subscribers that Apple billing continues until they cancel.
- Website subscribers who sign in on iPhone/iPad keep Pro access (multiplatform services, 3.1.3(b)). They are told their plan is managed outside the App Store, with no link or call to action to buy on the web.

## Before resubmitting (must be done on your Mac / in App Store Connect)

1. **Publish in Lovable** (the hosted fix).
2. **Upload a new build (26+).** The user-agent marker, the Stripe navigation removal and the StoreKit trial information are native changes: `bun install && bun run ios:sync && bun run ios:open`, archive, upload.
3. App Store Connect: make sure both `monthlyplan` and `annualplan` are attached to the submission. **Decide on the free trial:** if you want "7-day free trial" shown in the app, add a 1-week free introductory offer to both products. Otherwise the app correctly shows no trial.
4. On a **physical iPad and iPhone** using TestFlight with a sandbox account: Profile → Upgrade to Pro shows Apple prices; purchase Monthly; Pro unlocks; Restore purchases; Manage opens Apple subscriptions. Tap through Terms / Privacy / Support from the sign-in screen and confirm no "Pricing / Get started" header appears.
5. Sign in on the iPad with an account that has a **web (Stripe)** subscription: Pro is active, no purchase is offered, and Manage shows the "purchased outside the App Store" message.
6. Record the iPad purchase flow from the Home Screen and attach it to the review notes.

### Suggested reply to App Review

"Thank you. On iPad the app could incorrectly show our website checkout. We have fixed this on both the app and our server: inside the app, Pro subscriptions are now sold only through Apple In-App Purchase (auto-renewable subscriptions monthlyplan and annualplan), and our server rejects any web checkout request that comes from the app. Customers who already subscribed on our website can sign in and use the Pro features they bought, as allowed under 3.1.3(b); the app does not link to or promote web purchasing. Path: sign in with the demo account → Profile → Upgrade to Pro. A recording on an iPad is attached."

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