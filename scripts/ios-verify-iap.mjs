#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

// Run after cap sync. These are generated native files, not the hosted site.
const fail = (message) => { console.error(`Apple purchase preflight failed: ${message}`); process.exit(1); };
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const configPath = 'ios/App/App/capacitor.config.json';
if (!existsSync(configPath)) fail('Run bun run ios:sync on your Mac first.');
const config = JSON.parse(read(configPath));
if (config.appId !== 'com.peaceofmine.baby') fail('The native app identifier must match the App Store app: com.peaceofmine.baby.');
if (!config.packageClassList?.includes('AppleIAPPlugin')) fail('AppleIAPPlugin is not registered. Install dependencies and sync iOS again before archiving.');
const swiftPackage = read('ios/App/CapApp-SPM/Package.swift');
const podfile = read('ios/App/Podfile');
const podLock = read('ios/App/Podfile.lock');
if (swiftPackage) {
  if (!swiftPackage.includes('AppleIap')) fail('AppleIap is missing from the generated Swift package dependencies.');
} else if (!podfile.includes("pod 'AppleIAP'") || !podLock.includes('AppleIAP')) {
  fail('AppleIAP is missing from the installed CocoaPods dependencies.');
}
const swift = read('node_modules/apple-iap/ios/Sources/AppleIAPPlugin/AppleIAPPlugin.swift');
if (!swift.includes('"monthlyplan"') || !swift.includes('"annualplan"')) fail('The installed AppleIAP plugin does not contain both current product IDs. Reinstall dependencies.');
console.log('Apple purchase preflight passed: plugin registration, native dependency, app identifier, monthlyplan and annualplan.');
console.log('This does not verify an Xcode archive or App Store availability. Test BOTH plans in the new TestFlight build before submitting.');