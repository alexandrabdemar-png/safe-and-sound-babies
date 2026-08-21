import { registerPlugin } from "@capacitor/core";
import type { VisionBarcodeScannerPlugin } from "./definitions";

const VisionBarcodeScanner = registerPlugin<VisionBarcodeScannerPlugin>("VisionBarcodeScanner", {
  web: () => import("./web").then((m) => new m.VisionBarcodeScannerWeb()),
});

export * from "./definitions";
export { VisionBarcodeScanner };
