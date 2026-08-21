require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'VisionBarcodeScanner'
  s.version = package['version']
  s.summary = 'Native barcode scanning via Apple VisionKit for Peace of Mine.'
  s.license = 'UNLICENSED'
  s.homepage = 'https://peace-of-mine.lovable.app'
  s.author = 'Peace of Mine'
  s.source = { :git => '.', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  # DataScannerViewController (the API this plugin wraps) is iOS 16+ only.
  # The main app's Podfile / Xcode deployment target must be raised to 16.0
  # for this to build — see the plugin's README for the exact steps.
  s.ios.deployment_target = '16.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
