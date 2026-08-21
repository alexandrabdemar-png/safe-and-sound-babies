import UIKit
import VisionKit
import Vision

/// Hosts VisionKit's `DataScannerViewController` full-screen, with a simple
/// native Cancel button overlaid — `DataScannerViewController` has no
/// built-in dismiss/cancel affordance of its own, so callers are expected to
/// provide their own chrome around it.
///
/// Symbologies match what the previous web-based scanner (html5-qrcode) was
/// configured for: UPC-A, UPC-E, EAN-13, EAN-8, QR. Vision's
/// `VNBarcodeSymbology` has no distinct UPC-A case — UPC-A barcodes are
/// encoded as EAN-13 with a leading zero and are recognized via `.ean13`.
/// `payloadStringValue` for such a code comes back as the 13-digit EAN-13
/// form (leading zero included), not stripped to 12 digits the way some
/// UPC-A-specific scanners return it — callers matching against a barcode
/// database should account for this (try both the value and value-without-
/// leading-zero if a lookup misses).
@available(iOS 16.0, *)
final class BarcodeScannerContainerViewController: UIViewController, DataScannerViewControllerDelegate {
    private let onResult: (String) -> Void
    private let onCancel: () -> Void
    private let onError: (String) -> Void
    private var didEmitResult = false

    private lazy var dataScanner = DataScannerViewController(
        recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .qr])],
        qualityLevel: .balanced,
        recognizesMultipleItems: false,
        isHighFrameRateTrackingEnabled: false,
        isPinchToZoomEnabled: true,
        isGuidanceEnabled: true,
        isHighlightingEnabled: true
    )

    init(
        onResult: @escaping (String) -> Void,
        onCancel: @escaping () -> Void,
        onError: @escaping (String) -> Void
    ) {
        self.onResult = onResult
        self.onCancel = onCancel
        self.onError = onError
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        dataScanner.delegate = self

        addChild(dataScanner)
        dataScanner.view.frame = view.bounds
        dataScanner.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(dataScanner.view)
        dataScanner.didMove(toParent: self)

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        cancelButton.layer.cornerRadius = 18
        cancelButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(cancelButton)
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        do {
            try dataScanner.startScanning()
        } catch {
            onError(error.localizedDescription)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        dataScanner.stopScanning()
    }

    @objc private func cancelTapped() {
        onCancel()
    }

    // Single-shot: matching BarcodeScannerView.tsx's existing behavior
    // (`detectedRef.current` guard) — grab the first recognized barcode and
    // stop, rather than continuously reporting every frame.
    func dataScanner(
        _ dataScanner: DataScannerViewController,
        didAdd addedItems: [RecognizedItem],
        allItems: [RecognizedItem]
    ) {
        guard !didEmitResult else { return }
        for item in addedItems {
            if case .barcode(let barcode) = item, let value = barcode.payloadStringValue {
                didEmitResult = true
                onResult(value)
                return
            }
        }
    }

    func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        onError("Scanner became unavailable: \(error.localizedDescription)")
    }
}
