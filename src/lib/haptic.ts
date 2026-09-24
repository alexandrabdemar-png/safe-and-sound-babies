import { Capacitor } from "@capacitor/core";

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

async function native(kind: "light" | "success" | "medium") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: kind === "light" ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch {
    // ignore
  }
}

/** Brief haptic pulse: native Taptic Engine on iPhone, vibrate() on Android web. */
export function haptic(pattern: number | number[] = 12) {
  if (isNative()) {
    void native(Array.isArray(pattern) ? "success" : pattern > 12 ? "medium" : "light");
    return;
  }
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // not supported
  }
}

export const hapticLight = () => haptic(8);
export const hapticSuccess = () => haptic([8, 40, 8]);
export const hapticDismiss = () => haptic(15);
