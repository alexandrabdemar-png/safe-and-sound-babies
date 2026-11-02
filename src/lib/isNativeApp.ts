/**
 * True when this page is running inside the Peace of Mine iPhone/iPad app
 * (the native shell that loads the hosted site), false in Safari/Chrome.
 *
 * Checks several signals, because relying on `window.Capacitor` alone let
 * some launches fall through to the marketing page:
 *   1. the Capacitor bridge says it's native,
 *   2. the iOS native message handler Capacitor registers is present,
 *   3. the user agent is an iOS web view (no "Safari/" token, which every
 *      real Safari and iOS Chrome/Firefox/Edge includes) and not a known
 *      social-app in-app browser.
 */
type Win = {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  webkit?: { messageHandlers?: Record<string, unknown> };
};

const IN_APP_BROWSERS = /FBAN|FBAV|Instagram|Line\/|Snapchat|Pinterest|TikTok|musical_ly|Twitter/i;

export function isIOSAppWebView(userAgent: string): boolean {
  if (!/iPhone|iPad|iPod/.test(userAgent)) return false;
  if (!/AppleWebKit/.test(userAgent)) return false;
  if (/Safari\//.test(userAgent)) return false;
  if (IN_APP_BROWSERS.test(userAgent)) return false;
  return true;
}

export function nativeAppSignals(w: unknown, userAgent: string) {
  const win = (w ?? {}) as Win;
  let capacitor = false;
  try {
    capacitor =
      Boolean(win.Capacitor?.isNativePlatform?.()) ||
      ["ios", "android"].includes(win.Capacitor?.getPlatform?.() ?? "");
  } catch {
    capacitor = false;
  }
  const bridge = Boolean(win.webkit?.messageHandlers && "bridge" in win.webkit.messageHandlers);
  const webView = isIOSAppWebView(userAgent);
  return { capacitor, bridge, webView, native: capacitor || bridge || webView };
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return nativeAppSignals(window, navigator.userAgent).native;
}
