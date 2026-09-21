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
  ITSAppUsesNonExemptEncryption: false,
};

let plist = readFileSync(PLIST, "utf8");
const added = [];
const removed = [];

// App Store Connect blocks the App Privacy "Publish" button when the binary
// declares NSUserTrackingUsageDescription while the privacy answers say no
// data is used for tracking. This app genuinely does not track (no ads,
// analytics or attribution SDKs, no AppTrackingTransparency calls), so the
// key must NOT be present. Older builds shipped it — strip it if found.
// Robust removal: delete the key line plus whatever value element follows it,
// regardless of formatting (single-line string, multi-line string, <string/>).
if (plist.includes("<key>NSUserTrackingUsageDescription</key>")) {
  const lines = plist.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("<key>NSUserTrackingUsageDescription</key>")) {
      // skip the key line, then skip the following value element
      let j = i + 1;
      // skip blank lines
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length) {
        const v = lines[j].trim();
        if (/^<string\s*\/>$/.test(v) || /^<(true|false)\s*\/>$/.test(v)) {
          i = j;
        } else if (/^<string>.*<\/string>$/.test(v)) {
          i = j;
        } else if (/^<string>/.test(v)) {
          // multi-line string value
          while (j < lines.length && !lines[j].includes("</string>")) j++;
          i = j;
        }
      }
      continue;
    }
    out.push(lines[i]);
  }
  plist = out.join("\n");
  removed.push("NSUserTrackingUsageDescription");
}


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

// Custom URL scheme: how the OAuth system-browser tab hands the finished
// session back to the app (src/lib/nativeOAuth.ts). Without it iOS has no
// way to route com.peaceofmine.baby://oauth-callback and Google sign-in
// silently dead-ends back on the homepage.
if (!plist.includes("<key>CFBundleURLTypes</key>")) {
  const entry =
    "\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n" +
    "\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>com.peaceofmine.baby</string>\n" +
    "\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>com.peaceofmine.baby</string>\n\t\t\t</array>\n" +
    "\t\t</dict>\n\t</array>\n";
  plist = plist.replace(/\n<\/dict>\n<\/plist>/, `\n${entry}</dict>\n</plist>`);
  added.push("CFBundleURLTypes");
}

writeFileSync(PLIST, plist);

if (removed.length) {
  console.log(`✓ Info.plist removed: ${removed.join(", ")}`);
}
if (added.length) {
  console.log(`✓ Info.plist updated: ${added.join(", ")}`);
} else if (!removed.length) {
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
