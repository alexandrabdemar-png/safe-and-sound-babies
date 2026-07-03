import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { BarcodeScannerView } from "@/components/BarcodeScannerView";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleDetected(code: string) {
    onDetected(code);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan barcode
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          {open && (
            <BarcodeScannerView
              onDetected={handleDetected}
              onError={setError}
              className="relative h-full w-full"
            />
          )}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-primary/80" />
        </div>
        {error && (
          <p className="text-sm text-destructive">
            {error}. Check camera permissions and try again.
          </p>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Point the camera at a product barcode (UPC, EAN, QR).
        </p>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
