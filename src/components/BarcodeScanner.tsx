import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

const SCANNER_ID = "pom-barcode-scanner-dialog";

const FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    detectedRef.current = false;
    setError(null);
    setStarting(true);

    // Give the dialog animation time to mount the target div
    const timer = setTimeout(async () => {
      const el = document.getElementById(SCANNER_ID);
      if (!el) return;
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 220, height: 120 }, aspectRatio: 1 },
          (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            onDetected(decodedText);
            onClose();
          },
          () => {},
        );
        setStarting(false);
      } catch (e) {
        setStarting(false);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
          setError("Camera access denied. Please allow camera in your browser settings and try again.");
        } else if (msg.toLowerCase().includes("device") || msg.toLowerCase().includes("camera")) {
          setError("No camera found. Make sure your device has a camera.");
        } else {
          setError("Could not start camera. Check permissions and try again.");
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  function handleClose() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-sm p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-body text-base">
            <Camera className="h-4 w-4" /> Scan barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          {starting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          {/* html5-qrcode renders camera + viewfinder into this div */}
          <div id={SCANNER_ID} className="w-full" style={{ minHeight: 260 }} />
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 font-body text-xs text-destructive">
            {error}
          </p>
        )}

        <p className="text-center font-body text-xs text-muted-foreground">
          Point the camera at a UPC or EAN barcode on any product.
        </p>
        <Button variant="outline" className="w-full rounded-full font-body text-sm" onClick={handleClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
