#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VisionBarcodeScannerPlugin, "VisionBarcodeScanner",
  CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(startScan, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(stopScan, CAPPluginReturnPromise);
)
