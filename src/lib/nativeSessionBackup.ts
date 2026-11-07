import { supabase } from "@/integrations/supabase/client";
import { settleWithin } from "@/lib/promiseTimeout";
import { describeError, recordAuthDiagnostic } from "@/lib/authDiagnostics";
import { isNativeApp, nativeAppSignals } from "@/lib/isNativeApp";

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

/** One line per launch on the diagnostics screen: why a launch was or wasn't signed in. */
function launchReport(extra: string) {
  try {
    const s = nativeAppSignals(window, navigator.userAgent);
    const hasLocal = Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k));
    recordAuthDiagnostic(
      "info",
      `launch: app=${s.native} bridge=${s.capacitor || s.bridge} webview=${s.webView} saved-login=${hasLocal} ${extra}`,
    );
  } catch {
    /* diagnostics only */
  }
}

async function restore() {
  const Preferences = await getPrefs();
  if (!Preferences) {
    if (isNativeApp()) launchReport("native-storage=unavailable");
    return;
  }

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
    const { data } = await settleWithin(supabase.auth.getSession(), 10000, 'Saved session');
    if (data.session) {
      launchReport("signed-in=yes");
      await Preferences.set({ key: KEY, value: data.session.refresh_token });
      return;
    }
    const { value } = await Preferences.get({ key: KEY });
    if (!value) {
      launchReport("signed-in=no backup=none");
      return;
    }
    const { error } = await settleWithin(supabase.auth.refreshSession({ refresh_token: value }), 10000, 'Session refresh');
    launchReport(`signed-in=${error ? "no" : "restored"} backup=yes${error ? ` error=${error.status ?? "?"}` : ""}`);
    // Only forget the backup when the server says it's no longer valid —
    // a slow or dropped connection at launch must not log the user out
    // for good.
    if (error && (error.status === 400 || error.status === 401 || error.status === 403)) {
      await Preferences.remove({ key: KEY });
    }
  } catch (err) {
    launchReport(`restore-error=${describeError(err)}`);
    // Never block app start on this.
  }
}
