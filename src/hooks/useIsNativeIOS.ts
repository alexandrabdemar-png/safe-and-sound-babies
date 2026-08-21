import { useEffect, useState } from "react";

/**
 * True once we've confirmed this is running as a native iOS build (the
 * Capacitor-wrapped app, not the web site or an Android build), false once
 * we've confirmed it isn't, and null while that check is still in flight.
 * Extracted from the same check BarcodeScannerView.tsx already did inline —
 * a second caller (the Pro pricing screen, choosing between native
 * StoreKit purchase and Stripe web checkout) is what made a shared version
 * worth having instead of a second inline copy.
 */
export function useIsNativeIOS(): boolean | null {
  const [isNativeIOS, setIsNativeIOS] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        const native = Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
        if (!cancelled) setIsNativeIOS(native);
      } catch {
        // Capacitor isn't available at all (e.g. a plain web build that
        // never bundled it) — that's expected on web.
        if (!cancelled) setIsNativeIOS(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isNativeIOS;
}
