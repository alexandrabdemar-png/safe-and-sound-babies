import { useEffect, useId, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScannerState,
  type Html5QrcodeCameraScanConfig,
} from "html5-qrcode";
import { Loader2 } from "lucide-react";

// Reads UPC-A, UPC-E, EAN-13, EAN-8 (retail product barcodes) and QR codes.
// html5-qrcode's `useBarCodeDetectorIfSupported` makes it use the native
// BarcodeDetector Web API directly when the browser supports it (fast,
// hardware-accelerated on most Android/Chrome), and falls back to its own
// pure-JS decoder automatically everywhere else (Safari, Firefox, etc.) —
// this is the same "BarcodeDetector primary, JS library fallback" behavior
// the product spec asks for, without us having to hand-roll the feature
// detection and dual code paths ourselves.
const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  fps: 10,
  videoConstraints: {
    facingMode: "environment",
    // Cap resolution — every extra pixel is decoded on every frame, and
    // phone cameras default far higher than a barcode needs.
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

type Props = {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
  /** Set false to stop the camera without unmounting the component. */
  active?: boolean;
  className?: string;
};

export function BarcodeScannerView({ onDetected, onError, active = true, className }: Props) {
  const rawId = useId();
  const containerId = `barcode-scanner-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    detectedRef.current = false;
    setStarting(true);
    setError(null);

    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: SCAN_FORMATS,
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        SCAN_CONFIG,
        (decodedText) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          onDetected(decodedText);
        },
        () => {
          // Per-frame "nothing decoded yet" callback — expected on nearly
          // every frame while the user lines up the barcode, not an error.
        },
      )
      .then(() => {
        if (cancelled) {
          // Unmounted (or `active` flipped off) while start() was still in
          // flight — the cleanup below already ran and had nothing to stop
          // at the time, so the camera is still acquired. Release it now,
          // otherwise the stream leaks until the tab is closed.
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
          return;
        }
        setStarting(false);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not start camera";
        setError(msg);
        setStarting(false);
        onError?.(msg);
      });

    return () => {
      cancelled = true;
      scannerRef.current = null;
      if (scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) return;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          // Camera may already be gone (tab backgrounded, permissions
          // revoked mid-scan) — nothing actionable to do here.
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerId]);

  return (
    <div className={className}>
      <div
        id={containerId}
        className="h-full w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
      {starting && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
