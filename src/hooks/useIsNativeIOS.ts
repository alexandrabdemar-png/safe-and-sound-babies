import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/isNativeApp";

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
        // Also trust the multi-signal check: a missing bridge must never
        // expose web (Stripe) checkout inside the App Store app (Apple 3.1.1).
        const native =
          (Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform()) || isNativeApp();
        if (!cancelled) setIsNativeIOS(native);
      } catch {
        // Capacitor isn't available at all (e.g. a plain web build that
        // never bundled it) — that's expected on web.
        if (!cancelled) setIsNativeIOS(isNativeApp());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isNativeIOS;
}
