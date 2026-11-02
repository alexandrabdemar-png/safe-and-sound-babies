import { supabase } from "@/integrations/supabase/client";
import { settleWithin } from "@/lib/promiseTimeout";
import { describeError, recordAuthDiagnostic } from "@/lib/authDiagnostics";

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

const NATIVE_TIMEOUT_MS = 3000;
// The signed-in gate awaits the restore, so cap it: a slow network refresh
// must never leave the app on a blank loading screen.
const RESTORE_TIMEOUT_MS = 6000;

type Prefs = {
  get: (o: { key: string }) => Promise<{ value: string | null }>;
  set: (o: { key: string; value: string }) => Promise<void>;
  remove: (o: { key: string }) => Promise<void>;
};

async function getPrefs(): Promise<Prefs | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { Preferences } = await import("@capacitor/preferences");
    // Never return the Capacitor plugin object itself from an async
    // function: it's a Proxy that answers `then` with a native call, so the
    // returned promise never settles (see nativeAuthStorage.ts). Return
    // plain wrappers instead.
    return {
      get: (o) => settleWithin(Preferences.get(o), NATIVE_TIMEOUT_MS, "Preferences read"),
      set: (o) => settleWithin(Preferences.set(o), NATIVE_TIMEOUT_MS, "Preferences write"),
      remove: (o) => settleWithin(Preferences.remove(o), NATIVE_TIMEOUT_MS, "Preferences remove"),
    };
  } catch {
    return null;
  }
}

/** Awaited by the signed-in gate before it checks for a session. */
export function ensureNativeSessionRestored(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!restorePromise) {
    restorePromise = settleWithin(restore(), RESTORE_TIMEOUT_MS, "Session restore").catch(
      (err: unknown) => {
        // Carry on; the restore may still finish in the background.
        recordAuthDiagnostic("timeout", describeError(err));
      },
    );
  }
  return restorePromise;
}

async function restore() {
  const Preferences = await getPrefs();
  if (!Preferences) return;

  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void Preferences.remove({ key: KEY }).catch(() => {});
      } else if (session?.refresh_token) {
        void Preferences.set({ key: KEY, value: session.refresh_token }).catch(() => {});
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
