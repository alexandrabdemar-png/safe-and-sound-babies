# vision-barcode-scanner

Local (unpublished) Capacitor plugin: native barcode scanning via Apple
VisionKit's `DataScannerViewController` on iOS 16+. Not usable from a Linux
build environment — everything past `npm install` here requires a Mac with
Xcode.

## What this does

- iOS 16+ native builds: presents a full-screen native VisionKit scanner and
  reports the decoded barcode back to JS.
- Everything else (web, Android, iOS < 16): `isSupported()` returns `false`
  and the app's existing `WebBarcodeScannerView` (html5-qrcode) is used
  instead — the platform dispatch already happens in
  `src/components/BarcodeScannerView.tsx`, no per-caller changes needed.

## One-time setup on your Mac

This assumes you've already done the base iOS setup from `IOS_TESTFLIGHT.md`
(`bun run ios:setup`, which runs `cap add ios`).

1. From the repo root:
   ```bash
   npm install        # links this local plugin, already done if you pulled the latest commit
   npx cap sync ios    # picks up the new plugin's native source via its podspec
   ```
2. Open `ios/App/App.xcworkspace` in Xcode.
3. **Raise the deployment target to iOS 16.0** — `DataScannerViewController`
   doesn't exist before that. In Xcode: select the `App` project → `App`
   target → General → Minimum Deployments → set to `16.0`. You'll also want
   to check `ios/App/Podfile`'s `platform :ios, 'XX.X'` line matches.
4. Confirm `NSCameraUsageDescription` is present in `Info.plist` — it should
   already be there from the base setup (the existing web-based scanner
   already needs camera access), but VisionKit uses the same key, so nothing
   new to add if it's already there.
5. Build and run on a **real device** running iOS 16+ — `DataScannerViewController`
   does not work in the iOS Simulator.

## Testing checklist (do this before trusting the native path)

- [ ] Scan a real UPC-A barcode (e.g. any grocery item) — confirm the value
      your app receives matches what you'd expect. Note: Apple's Vision
      framework has no distinct UPC-A symbology; UPC-A codes are recognized
      as EAN-13 with a leading zero, so the string you get back may be
      13 digits (with a leading `0`) rather than 12 — if your product-lookup
      APIs expect 12-digit UPC-A, you may need to strip a leading `0` before
      querying them. Check this against a real scan before shipping.
- [ ] Scan an EAN-13, EAN-8, and a QR code.
- [ ] Tap Cancel (top-right, on the native scanner screen) — confirm the app
      returns to wherever you triggered the scan from, cleanly.
- [ ] Deny camera permission (Settings → Peace of Mine → Camera → off), then
      try to scan — confirm you get a sensible error, not a crash or a
      silent black screen.
- [ ] Background the app mid-scan (e.g. swipe up) and return — confirm the
      scanner doesn't leave the camera running or crash.
- [ ] Test on a device running iOS 15 (if you have one) or force
      `isSupported()` to return `false` in the simulator — confirm the app
      falls back to the existing web-based scanner cleanly.

## Files

- `src/definitions.ts` — the plugin's TypeScript interface.
- `src/web.ts` — web fallback (always reports unsupported).
- `src/index.ts` — plugin registration.
- `ios/Plugin/VisionBarcodeScannerPlugin.swift` — Capacitor bridge (`isSupported`, `startScan`, `stopScan`).
- `ios/Plugin/VisionBarcodeScannerPlugin.m` — Objective-C registration glue Capacitor's bridge requires.
- `ios/Plugin/BarcodeScannerContainerViewController.swift` — the actual native scanner screen (VisionKit `DataScannerViewController` + a Cancel button).
