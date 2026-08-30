import { useEffect } from "react";

/**
 * Makes Universal Links (password reset, magic link, email confirmation —
 * anything that emails an https:// link back to the user) open inside the
 * native app instead of Safari. Without this, iOS has no code path to hand
 * an opened https:// link to the app even once Associated Domains is
 * configured — @capacitor/app's appUrlOpen is what actually receives it.
 *
 * No-op on web (Capacitor isn't present) and runs unconditionally
 * regardless of auth state, since password reset must work while signed
 * out. Call once from the root layout.
 */
export function useDeepLinks() {
  useEffect(() => {
    let cancelled = false;
    const listeners: Array<{ remove: () => void }> = [];

    (async () => {
      let Capacitor: typeof import("@capacitor/core").Capacitor;
      try {
        ({ Capacitor } = await import("@capacitor/core"));
      } catch {
        return; // Capacitor not available (shouldn't happen, but never block the app on it)
      }
      if (!Capacitor.isNativePlatform() || cancelled) return;

      const { App } = await import("@capacitor/app");

      const { parseNativeHandoff } = await import("@/lib/nativeOAuth");
      const { supabase } = await import("@/integrations/supabase/client");

      listeners.push(
        await App.addListener("appUrlOpen", ({ url }) => {
          if (cancelled) return;

          // Google/Apple sign-in finished in the system browser tab and is
          // handing the session back over our custom URL scheme (see
          // src/lib/nativeOAuth.ts). Install it in the app's own webview,
          // which is the storage jar the rest of the app actually reads.
          const handoff = parseNativeHandoff(url);
          if (handoff) {
            import("@capacitor/browser")
              .then(({ Browser }) => Browser.close())
              .catch(() => {});
            if (handoff.error || !handoff.access_token || !handoff.refresh_token) {
              window.location.href = `/auth?error=${encodeURIComponent(
                handoff.error ?? "Sign-in didn't complete. Please try again.",
              )}`;
              return;
            }
            supabase.auth
              .setSession({
                access_token: handoff.access_token,
                refresh_token: handoff.refresh_token,
              })
              .then(({ error }) => {
                if (error) {
                  window.location.href = `/auth?error=${encodeURIComponent(error.message)}`;
                  return;
                }
                // Session now lives in the app's webview — /auth/callback
                // routes to /home or /onboarding exactly as it does on web.
                window.location.href = "/auth/callback";
              })
              .catch(() => {
                window.location.href = "/auth?error=Sign-in%20failed.%20Please%20try%20again.";
              });
            return;
          }

          // If this deep link is arriving while the OAuth sign-in flow's
          // system browser tab (src/lib/browser.ts) is still open on top of
          // the app, close it — otherwise it's left stranded over a screen
          // that already finished handling the sign-in underneath it.
          // Harmless no-op when nothing is open (e.g. the password-reset /
          // magic-link cases, which never open one).
          import("@capacitor/browser")
            .then(({ Browser }) => Browser.close())
            .catch(() => {});
          // The app is already showing the hosted origin in its WKWebView, so
          // navigating to the deep-linked URL's path/query/hash keeps us
          // same-origin instead of bouncing out to an external browser.
          const target = new URL(url);
          window.location.href = target.pathname + target.search + target.hash;
        }),
      );
    })();

    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
    };
  }, []);
}
