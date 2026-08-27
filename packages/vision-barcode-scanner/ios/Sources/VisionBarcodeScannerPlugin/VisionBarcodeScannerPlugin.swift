import Foundation
import Capacitor
import VisionKit

/// Capacitor bridge for BarcodeScannerContainerViewController. Presents a
/// full-screen native VisionKit scanner over the WebView and reports back
/// via JS events — this deliberately mirrors how @capacitor/camera works
/// (present a native screen, resolve/emit once, dismiss) rather than trying
/// to embed VisionKit's live preview inline inside the web page's DOM the
/// way the previous html5-qrcode-based scanner did.
///
/// Registered via the CAPBridgedPlugin protocol (rather than a separate
/// Objective-C .m file + CAP_PLUGIN macro) — this is the modern
/// registration style and, unlike the .m-file approach, works whether this
/// package is pulled in via CocoaPods or Swift Package Manager.
@objc(VisionBarcodeScannerPlugin)
public class VisionBarcodeScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionBarcodeScannerPlugin"
    public let jsName = "VisionBarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopScan", returnType: CAPPluginReturnPromise),
    ]

    private var presentedScanner: UIViewController?

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            // DataScannerViewController's class properties are main-actor
            // isolated (VisionKit is a UI framework); Capacitor's plugin
            // bridge invokes @objc methods like this one via WKWebView's
            // script message handler, which WebKit guarantees runs on the
            // main thread — assumeIsolated asserts that known-true fact to
            // the compiler rather than actually hopping threads.
            let supported = MainActor.assumeIsolated { DataScannerViewController.isSupported }
            call.resolve(["supported": supported])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func startScan(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.reject("VisionKit barcode scanning requires iOS 16 or later")
            return
        }
        guard MainActor.assumeIsolated({ DataScannerViewController.isSupported }) else {
            call.reject("This device doesn't support VisionKit barcode scanning")
            return
        }
        guard MainActor.assumeIsolated({ DataScannerViewController.isAvailable }) else {
            call.reject("Barcode scanning isn't available right now (camera may be in use, or permission was denied)")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let presentingVC = self.bridge?.viewController else {
                call.reject("No view controller available to present the scanner on")
                return
            }
            if self.presentedScanner != nil {
                call.reject("A scan is already in progress")
                return
            }

            let container = BarcodeScannerContainerViewController(
                onResult: { [weak self] value in
                    self?.notifyListeners("barcodeDetected", data: ["value": value])
                    self?.dismissScanner()
                },
                onCancel: { [weak self] in
                    self?.notifyListeners("scanCancelled", data: [:])
                    self?.dismissScanner()
                },
                onError: { [weak self] message in
                    self?.notifyListeners("scanError", data: ["message": message])
                    self?.dismissScanner()
                }
            )
            container.modalPresentationStyle = .fullScreen
            self.presentedScanner = container
            presentingVC.present(container, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.dismissScanner()
            call.resolve()
        }
    }

    private func dismissScanner() {
        guard let scanner = presentedScanner else { return }
        presentedScanner = nil
        scanner.dismiss(animated: true)
    }
}
