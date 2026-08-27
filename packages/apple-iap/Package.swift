// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    // Capacitor derives the expected SPM product name from the npm package
    // name by naive PascalCasing ("apple-iap" -> "AppleIap", not "AppleIAP")
    // — this must match exactly (SPM product names are case-sensitive) or
    // CapApp-SPM's generated Package.swift can't resolve this dependency,
    // breaking the whole package graph. Compare vision-barcode-scanner,
    // whose product name is the same naive PascalCase of its npm name.
    name: "AppleIap",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "AppleIap",
            targets: ["AppleIAPPlugin"])
    ],
    dependencies: [
        // Matches vision-barcode-scanner's own Package.swift — same reasoning
        // applies here (SPM's `from:` only auto-updates within a major
        // version, so this must track the app's actual Capacitor major).
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "AppleIAPPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/AppleIAPPlugin")
    ]
)
