#!/usr/bin/env node
/**
 * Patches the generated iOS project with everything App Store / TestFlight
 * review requires, so `bun run ios:setup` is repeatable:
 *
 *   1. Info.plist privacy usage strings (camera = barcode scanning,
 *      photo library = product photos, notifications background mode).
 *   2. Push notification background mode (remote-notification).
 *   3. App Transport Security left at defaults (all traffic is https).
 *
 * Safe to run repeatedly — existing keys are left untouched.
 * Run AFTER `npx cap add ios` / `npx cap sync ios`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PLIST = "ios/App/App/Info.plist";

if (!existsSync(PLIST)) {
  console.error(`✗ ${PLIST} not found. Run "npx cap add ios" first.`);
  process.exit(1);
}

const STRINGS = {
  NSCameraUsageDescription:
    "Peace of Mine uses the camera to scan product barcodes so it can check them against safety recall databases.",
  NSPhotoLibraryUsageDescription:
    "Peace of Mine lets you attach photos of your baby products so you can identify them later.",
  NSPhotoLibraryAddUsageDescription:
    "Peace of Mine can save exported safety records and product photos to your photo library.",
  NSUserTrackingUsageDescription: "Peace of Mine does not track you across other apps or websites.",
  ITSAppUsesNonExemptEncryption: false,
};

let plist = readFileSync(PLIST, "utf8");
const added = [];

for (const [key, value] of Object.entries(STRINGS)) {
  if (plist.includes(`<key>${key}</key>`)) continue;
  const entry =
    typeof value === "boolean"
      ? `\t<key>${key}</key>\n\t<${value}/>\n`
      : `\t<key>${key}</key>\n\t<string>${value}</string>\n`;
  plist = plist.replace(/\n<\/dict>\n<\/plist>/, `\n${entry}</dict>\n</plist>`);
  added.push(key);
}

// Background mode required for silent/remote push delivery.
if (!plist.includes("<key>UIBackgroundModes</key>")) {
  const entry =
    "\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n";
  plist = plist.replace(/\n<\/dict>\n<\/plist>/, `\n${entry}</dict>\n</plist>`);
  added.push("UIBackgroundModes");
}

writeFileSync(PLIST, plist);

if (added.length) {
  console.log(`✓ Info.plist updated: ${added.join(", ")}`);
} else {
  console.log("✓ Info.plist already configured — nothing to do.");
}

console.log(`
Remaining manual steps in Xcode (one time):
  1. Open ios/App/App.xcworkspace
  2. Select the "App" target → Signing & Capabilities
  3. Set your Team, then click "+ Capability" and add:
       • Push Notifications
       • Background Modes → check "Remote notifications"
       • Associated Domains → add an entry: applinks:peace-of-mine.lovable.app
         (this makes links like password reset / magic link emails open
         inside the app instead of Safari — the site already serves the
         required apple-app-site-association file)
  4. Product → Archive → Distribute App → TestFlight
`);
