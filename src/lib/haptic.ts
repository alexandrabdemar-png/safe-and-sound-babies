/** Trigger a brief haptic pulse on supported devices (Android Chrome). No-op elsewhere. */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // silently ignore — not all browsers support this
  }
}

export const hapticLight = () => haptic(8);
export const hapticSuccess = () => haptic([8, 40, 8]);
export const hapticDismiss = () => haptic(15);
