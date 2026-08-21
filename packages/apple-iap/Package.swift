// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AppleIAP",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "AppleIAP",
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
