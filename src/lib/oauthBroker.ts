/**
 * Builds the URL for Lovable's OAuth broker (/~oauth/initiate), matching
 * the same query params @lovable.dev/cloud-auth-js's signInWithOAuth
 * constructs internally before it does its own window.location.href
 * redirect (see node_modules/@lovable.dev/cloud-auth-js/dist/index.js).
 *
 * Used on native builds to open this URL in a real system browser tab
 * (see src/lib/browser.ts's openUrl, an SFSafariViewController on iOS)
 * instead of navigating the app's own embedded webview to it directly.
 * Google (and increasingly other providers) restrict or silently reject
 * OAuth sign-in attempted from an embedded app webview — the leading
 * theory for why sign-in failed there with no visible error and Google's
 * own sign-in page never appearing at all. A real system browser tab
 * doesn't read as an embedded webview to the provider.
 *
 * Needs a fully-qualified absolute URL (unlike the library's own relative
 * "/~oauth/initiate", which resolves fine for a same-page redirect) since
 * this opens in a separate browser context with no current-page origin to
 * resolve a relative URL against.
 */
export function buildOAuthInitiateUrl(
  origin: string,
  provider: "google" | "apple",
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    provider,
    redirect_uri: redirectUri,
    state: generateState(),
  });
  return `${origin}/~oauth/initiate?${params.toString()}`;
}

function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
