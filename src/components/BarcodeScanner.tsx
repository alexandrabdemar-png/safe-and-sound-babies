import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

// Restrict to the formats real product barcodes use — decoding every
// supported format (PDF417, Data Matrix, Aztec, etc.) on every frame is
// what makes this feel slow. No loss of coverage for retail products.
const SCAN_HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.QR_CODE],
  ],
]);

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const reader = new BrowserMultiFormatReader(SCAN_HINTS);
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!back) throw new Error('No camera available');
        if (cancelled || !videoRef.current) return;
        controlsRef.current = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              const text = result.getText();
              controlsRef.current?.stop();
              controlsRef.current = null;
              onDetected(text);
              onClose();
            }
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not start camera');
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan barcode
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-primary/80" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground text-center">
          Point the camera at a product barcode (UPC, EAN, QR).
        </p>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </DialogContent>
    </Dialog>
  );
}
