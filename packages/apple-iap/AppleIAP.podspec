require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'AppleIAP'
  s.version = package['version']
  s.summary = 'Native Apple In-App Purchase (StoreKit 2) for Peace of Mine.'
  s.license = 'UNLICENSED'
  s.homepage = 'https://peace-of-mine.lovable.app'
  s.author = 'Peace of Mine'
  s.source = { :git => '.', :tag => s.version.to_s }
  # Kept as a CocoaPods fallback for any project not using Swift Package
  # Manager (see Package.swift for the SPM path, which cap sync prefers
  # when it's present at the package root) — same pattern as
  # vision-barcode-scanner's own podspec.
  s.source_files = 'ios/Sources/AppleIAPPlugin/**/*.swift'
  s.ios.deployment_target = '16.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
