// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VisionBarcodeScanner",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "VisionBarcodeScanner",
            targets: ["VisionBarcodeScannerPlugin"])
    ],
    dependencies: [
        // Match the app's actual Capacitor version (8.x, per its
        // @capacitor/* package versions) — an earlier `from: "7.0.0"` here
        // triggered "built for Capacitor 7, it might cause issues" from
        // `cap sync`, since SPM's `from:` only auto-updates within the
        // same major version.
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "VisionBarcodeScannerPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/VisionBarcodeScannerPlugin")
    ]
)
