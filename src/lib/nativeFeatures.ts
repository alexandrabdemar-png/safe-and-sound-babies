import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Opens the iPhone share sheet (or the browser's share / clipboard). Returns false if nothing could share. */
export async function shareLink(opts: { title: string; text?: string; url: string }): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share(opts);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Face ID / Touch ID check on iPhone. Resolves true when verified, or when biometrics aren't available (web / no Face ID set up). */
export async function verifyWithBiometrics(reason: string): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const { isAvailable } = await NativeBiometric.isAvailable({ useFallback: true });
    if (!isAvailable) return true;
    await NativeBiometric.verifyIdentity({ reason, title: "Unlock Emergency Info", useFallback: true });
    return true;
  } catch {
    return false;
  }
}
