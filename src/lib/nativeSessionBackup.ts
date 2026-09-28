import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the sign-in alive across app launches on iPhone.
 *
 * The iOS build loads the hosted site in a WKWebView, and iOS treats that
 * site's localStorage as evictable website data — it can be wiped when the
 * app is closed, so users had to sign in again on every launch. We mirror
 * the refresh token into native app storage (UserDefaults via Capacitor
 * Preferences), which iOS never evicts, and restore from it at startup.
 * No-op on the web.
 */
const KEY = "pom.auth.refresh_token";

let restorePromise: Promise<void> | null = null;
let listening = false;

async function getPrefs() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  } catch {
    return null;
  }
}

/** Awaited by the signed-in gate before it checks for a session. */
export function ensureNativeSessionRestored(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!restorePromise) restorePromise = restore();
  return restorePromise;
}

async function restore() {
  const Preferences = await getPrefs();
  if (!Preferences) return;

  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void Preferences.remove({ key: KEY });
      } else if (session?.refresh_token) {
        void Preferences.set({ key: KEY, value: session.refresh_token });
      }
    });
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await Preferences.set({ key: KEY, value: data.session.refresh_token });
      return;
    }
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return;
    const { error } = await supabase.auth.refreshSession({ refresh_token: value });
    if (error) await Preferences.remove({ key: KEY });
  } catch {
    // Never block app start on this.
  }
}
