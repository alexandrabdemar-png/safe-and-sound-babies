/**
 * Native (iOS/Capacitor) OAuth token handoff.
 *
 * The native shell loads the hosted site in a WKWebView, but the OAuth flow
 * itself has to run in a real system browser tab (Google rejects sign-in
 * started from an embedded app webview). That means the session lands in
 * Safari's storage jar, not the app's — and getting it back into the app
 * relied on a Universal Link firing off a *server redirect* inside
 * SFSafariViewController, which iOS does not reliably do (Apple's flow
 * happened to survive it; Google's, which redirects immediately when the
 * user is already signed in, did not — the tab flashed open and the app was
 * left back on the homepage with no session and no error).
 *
 * A custom URL scheme redirect DOES reliably open the app from a system
 * browser tab, so that's what we use: the callback page, when it detects it
 * is running in the system browser on behalf of the native app, hands the
 * freshly-minted tokens (or the error) back over
 * `com.peaceofmine.baby://oauth-callback`. The app then calls setSession and
 * finishes the sign-in in its own webview.
 *
 * Tokens never leave the device: the redirect is handled by iOS locally.
 */

/** Registered by scripts/ios-configure.mjs as a CFBundleURLTypes scheme. */
export const NATIVE_SCHEME = "com.peaceofmine.baby";
export const NATIVE_HANDOFF_HOST = "oauth-callback";

/** Marks a redirect_uri as "started from the native app, hand tokens back". */
export const NATIVE_FLAG = "native";

export function isNativeHandoffRequest(search: string): boolean {
  return new URLSearchParams(search).get(NATIVE_FLAG) === "1";
}

export type NativeHandoff =
  | { access_token: string; refresh_token: string; error?: undefined }
  | { error: string; access_token?: undefined; refresh_token?: undefined };

export function buildNativeHandoffUrl(payload: NativeHandoff): string {
  const params = new URLSearchParams();
  if (payload.error) {
    params.set("error", payload.error);
  } else {
    params.set("access_token", payload.access_token);
    params.set("refresh_token", payload.refresh_token);
  }
  return `${NATIVE_SCHEME}://${NATIVE_HANDOFF_HOST}?${params.toString()}`;
}

/**
 * Parses an inbound app URL. Returns null when the URL isn't an OAuth
 * handoff (e.g. a password-reset Universal Link), so callers can fall
 * through to their normal deep-link handling.
 */
export function parseNativeHandoff(url: string): NativeHandoff | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${NATIVE_SCHEME}:`) return null;
  // Custom-scheme URLs put the "host" in either host or pathname depending
  // on how iOS normalises them — accept both.
  const target = parsed.host || parsed.pathname.replace(/^\/+/, "");
  if (target !== NATIVE_HANDOFF_HOST) return null;

  const params = parsed.searchParams;
  const error = params.get("error");
  if (error) return { error };
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) {
    return { error: "Sign-in didn't complete. Please try again." };
  }
  return { access_token, refresh_token };
}
