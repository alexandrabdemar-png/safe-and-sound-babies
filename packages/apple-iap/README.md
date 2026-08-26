# apple-iap

Local (unpublished) Capacitor plugin: native Apple In-App Purchase via
StoreKit 2, for the app's one Pro subscription. Not usable from a Linux
build environment — everything past `npm install` here requires a Mac with
Xcode, and StoreKit purchases can't be tested at all without an actual App
Store Connect subscription product and a sandbox tester Apple ID.

## What this does

- Purchases and restores the `com.peaceofmine.baby.pro.monthly` subscription
  through Apple's own purchase sheet, instead of Stripe checkout — required
  by App Store review for unlocking a digital feature (Pro) inside an iOS app.
- The web app is unaffected: `StripeEmbeddedCheckout` keeps handling web
  purchases exactly as before. `src/routes/_authenticated/pricing.tsx`
  branches between the two based on platform.
- This plugin never decides entitlement on its own. Every purchase/restore
  result still has to be reported to the server
  (`verifyAppleTransaction` in `src/utils/appleIap.functions.ts`), which
  re-verifies it directly against Apple before writing to `subscriptions` —
  see that file's doc comment for why a client-reported "it worked" is
  never trusted on its own.

## One-time setup on your Mac

This assumes you've already done the base iOS setup from `IOS_TESTFLIGHT.md`.

1. From the repo root:
   ```bash
   npm install        # links this local plugin, already done if you pulled the latest commit
   npx cap sync ios    # picks up the new plugin's native source
   ```
2. In Xcode, on the **App** target → *Signing & Capabilities*:
   **+ Capability → In-App Purchase**.
3. Build and run — StoreKit purchases work in the iOS **Simulator** too
   (unlike the barcode scanner), using a local `.storekit` test file or a
   sandbox tester account. A real device is only required for a true
   end-to-end test against your live App Store Connect configuration.

## App Store Connect setup (only you can do this — it's your developer account)

1. **Users and Access → Integrations → In-App Purchase** — create an API key
   with the **App Manager** role (needs the Admin role on your account to
   create it). Download the `.p8` file once — Apple only lets you download it
   the one time — and note its **Key ID** and the **Issuer ID** shown on that
   same page.
2. **My Apps → Peace of Mine → Monetization → Subscriptions** — create a
   subscription group (any internal name, e.g. "Pro"), then inside it create
   one auto-renewable subscription:
   - Product ID: `com.peaceofmine.baby.pro.monthly` (must match exactly —
     this is hardcoded in both `src/definitions.ts` and the native plugin).
   - Price: $3.33/month (or your chosen tier).
   - Add a 7-day free trial as an introductory offer, matching the existing
     Stripe trial.
   - Fill in the required subscription display name, description, and a
     screenshot of the paywall for review.
3. **App Information** — note the numeric **Apple ID** for the app (shown
   near the top of the App Information page, distinct from the bundle id) —
   this is `APPLE_IAP_APP_APPLE_ID`.
4. **App Store Server Notifications** — in the same Subscriptions section,
   set the **Production Server URL** (and Sandbox URL, if offered
   separately) to:
   `https://<your-deployed-host>/api/public/payments/apple-webhook`
5. Set these backend secrets (same place you set the `STRIPE_*`/`APNS_*`
   ones):

   | Secret | Value |
   | --- | --- |
   | `APPLE_IAP_KEY_ID` | Key ID from step 1 |
   | `APPLE_IAP_ISSUER_ID` | Issuer ID from step 1 |
   | `APPLE_IAP_PRIVATE_KEY` | Full contents of the downloaded `.p8` file |
   | `APPLE_IAP_BUNDLE_ID` | `com.peaceofmine.baby` |
   | `APPLE_IAP_APP_APPLE_ID` | Numeric Apple ID from step 3 |

6. **Sandbox tester** — Users and Access → Sandbox → Testers → create one
   with an email you don't otherwise use with an Apple ID. Sign into it on
   your test device under Settings → App Store → Sandbox Account (not the
   regular Apple ID) before testing a purchase.
7. A brand-new subscription typically needs to sit in **Ready to Submit**
   status (fully filled out, screenshot attached) before StoreKit will even
   let a sandbox purchase go through — an incomplete product silently fails
   to load in `getProduct()`.

## Testing checklist (do this before trusting the native path)

- [ ] `getProduct()` returns the real price/trial info from App Store Connect.
- [ ] Purchase completes with a sandbox tester account; `verifyAppleTransaction`
      is called and the app unlocks Pro.
- [ ] Cancel out of the purchase sheet — confirm a clean, non-crashing
      `userCancelled` rejection, not a hang.
- [ ] Force-quit the app immediately after a successful purchase but before
      it could report to the server, reopen, and call `restorePurchases()` —
      confirm the purchase is recovered and still unlocks Pro.
- [ ] Let a sandbox subscription renew (sandbox renewals happen every few
      minutes, not monthly) — confirm the `transactionUpdate` listener fires
      and the renewal reaches the server.
- [ ] Refund a sandbox transaction (App Store Connect → Sandbox → Testers →
      that tester → transaction → Refund) — confirm the `apple-webhook`
      REFUND notification downgrades the account back to free.
- [ ] Confirm the pricing screen on iOS shows the native purchase button, and
      the web build still shows Stripe checkout unchanged.

## Files

- `src/definitions.ts` — the plugin's TypeScript interface and the shared
  `APPLE_PRO_MONTHLY_PRODUCT_ID` constant.
- `src/web.ts` — web fallback (every method throws; the web app never calls
  this plugin, it keeps using Stripe).
- `src/index.ts` — plugin registration.
- `Package.swift` — Swift Package Manager manifest, used when `ios/`'s
  Capacitor project is SPM-based (no `Podfile`).
- `AppleIAP.podspec` — CocoaPods fallback manifest, used when `ios/`'s
  Capacitor project has a `Podfile`.
- `ios/Sources/AppleIAPPlugin/AppleIAPPlugin.swift` — Capacitor bridge
  (`getProduct`, `purchase`, `restorePurchases`, plus a `transactionUpdate`
  listener for renewals) wrapping StoreKit 2, registered via the
  `CAPBridgedPlugin` protocol (same pattern as `vision-barcode-scanner`).
