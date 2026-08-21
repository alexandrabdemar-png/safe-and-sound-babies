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
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
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
