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

      listeners.push(
        await App.addListener("appUrlOpen", ({ url }) => {
          if (cancelled) return;
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
