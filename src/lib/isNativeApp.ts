/**
 * True when this page is running inside the Peace of Mine iPhone/iPad app
 * (the native shell that loads the hosted site), false in Safari/Chrome.
 *
 * Checks several signals, because relying on `window.Capacitor` alone let
 * some launches fall through to the marketing page (and, on iPad, to web
 * checkout — Apple 3.1.1 rejection, November 18, 2026):
 *   1. the Capacitor bridge says it's native,
 *   2. the iOS native message handler Capacitor registers is present,
 *   3. the user agent carries the app's own marker (capacitor.config.ts
 *      `ios.appendUserAgent`, present in builds from November 2026 on),
 *   4. the user agent is an iOS web view: no "Safari/" token (every real
 *      Safari and iOS Chrome/Firefox/Edge includes one) and not a known
 *      social-app in-app browser. iPadOS web views report a *desktop Mac*
 *      user agent ("Macintosh; Intel Mac OS X"), so a Mac-style web view
 *      user agent on a touch screen counts as the iPad app too.
 */
type Win = {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  webkit?: { messageHandlers?: Record<string, unknown> };
};

/** Appended to the web view's user agent by the native shell. */
export const APP_USER_AGENT_MARKER = "PeaceOfMineApp";

const IN_APP_BROWSERS = /FBAN|FBAV|Instagram|Line\/|Snapchat|Pinterest|TikTok|musical_ly|Twitter/i;

export function hasAppUserAgentMarker(userAgent: string): boolean {
  return userAgent.includes(APP_USER_AGENT_MARKER);
}

/**
 * maxTouchPoints is only known in the browser. Pass it to recognise the
 * iPad app's desktop-style user agent; omit it (server side) to treat any
 * Mac-style WebKit web view as possibly the iPad app.
 */
export function isIOSAppWebView(userAgent: string, maxTouchPoints?: number): boolean {
  if (hasAppUserAgentMarker(userAgent)) return true;
  if (!/AppleWebKit/.test(userAgent)) return false;
  if (/Safari\//.test(userAgent)) return false;
  if (IN_APP_BROWSERS.test(userAgent)) return false;
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  if (/Macintosh/.test(userAgent)) {
    return maxTouchPoints === undefined ? true : maxTouchPoints > 1;
  }
  return false;
}

export function nativeAppSignals(w: unknown, userAgent: string, maxTouchPoints = 0) {
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
  const webView = isIOSAppWebView(userAgent, maxTouchPoints);
  return { capacitor, bridge, webView, native: capacitor || bridge || webView };
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return nativeAppSignals(window, navigator.userAgent, navigator.maxTouchPoints ?? 0).native;
}
