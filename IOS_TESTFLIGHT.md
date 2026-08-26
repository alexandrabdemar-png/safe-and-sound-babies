# iOS build → TestFlight

The app is server-rendered, so the iOS build is a **native shell that loads the
hosted app over https** (`capacitor.config.ts` → `server.url`). Push
notifications, the barcode camera and the in-app browser all run natively
through the Capacitor bridge.

## One-time setup (on a Mac with Xcode 15+)

```bash
sudo gem install cocoapods          # if not installed
bun install
bun run ios:setup                   # cap add ios + sync + Info.plist patch
open ios/App/App.xcworkspace
```

In Xcode, on the **App** target → *Signing & Capabilities*:

1. Pick your Apple Developer **Team** (bundle id `com.peaceofmine.baby`).
2. **+ Capability → Push Notifications**.
3. **+ Capability → Background Modes** → check *Remote notifications*.
4. **+ Capability → In-App Purchase**.

## Pro subscription (Apple In-App Purchase)

Pro is purchased through native StoreKit on iOS (Stripe stays the checkout for the
web build) — see `packages/apple-iap/README.md` for the full setup: creating the
subscription product in App Store Connect, the In-App Purchase API key, the App
Store Server Notifications webhook URL, and the 5 backend secrets it needs
(`APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`,
`APPLE_IAP_BUNDLE_ID`, `APPLE_IAP_APP_APPLE_ID`). None of this is optional — without
it, tapping "Start free trial" on iOS will fail.

## Push notifications (APNs)

Device tokens register automatically on native builds
(`src/hooks/usePushRegistration.ts`) and are stored on `profiles.apns_device_token`.
Sending happens server-side in `src/lib/apns.server.ts`.

Create an **APNs Auth Key (.p8)** in the Apple Developer portal
(Certificates → Keys → enable *Apple Push Notifications service*), then set
these backend secrets:

| Secret             | Value                                                 |
| ------------------ | ----------------------------------------------------- |
| `APNS_KEY_ID`      | Key ID of the .p8                                     |
| `APNS_TEAM_ID`     | Apple Developer Team ID                               |
| `APNS_KEY_P8`      | full PEM contents of the .p8 file                     |
| `APNS_BUNDLE_ID`   | `com.peaceofmine.baby` (default)                       |
| `APNS_ENVIRONMENT` | `sandbox` for TestFlight/dev builds, else `production` |

TestFlight builds use the **sandbox** APNs environment unless the build is
distributed through App Store Connect with a production profile — start with
`sandbox`, switch to `production` at launch.

## Ship a build

```bash
bun run ios:sync        # after any web/config change
```

Then in Xcode: bump the build number → **Product → Archive** → **Distribute App
→ TestFlight & App Store**.

Testing against preview instead of production:

```bash
CAP_SERVER_URL=https://id-preview--<project-id>.lovable.app bun run ios:sync
```

## TestFlight notes

- **Internal testing** (up to 100 testers on your team): available as soon as
  the build finishes processing, no review needed — the app does not have to be
  finished.
- **External testing** (up to 10,000 via public link): needs a light Beta App
  Review (usually 1–2 days). Requirements: no crashes, working sign-in, a
  reachable privacy policy (`/privacy-policy`), and in-app account deletion
  (`/profile`).
- Builds expire after 90 days.
- Keep the medical/safety disclaimer visible (`PediatricianDisclaimer`) — Apple
  requires it for recall/health guidance content.
