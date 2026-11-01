// Keeps the Supabase login on iPhone across app restarts.
//
// The iPhone app is a native shell around the hosted site, so the session
// lives in the web view's localStorage. iOS can clear that storage for a
// remotely loaded site (between launches, under storage pressure, or via
// WebKit's tracking-prevention cleanup), which shows up as "I have to log in
// every time I open the app". Every write is therefore also saved to the iOS
// Keychain (via the Face ID plugin's plain, non-biometric data store — no
// Face ID prompt), and a read that finds localStorage empty restores from it.
//
// localStorage stays the primary copy, so if the Keychain call is missing
// (an older app build without the plugin) or fails, behaviour is exactly
// what it was before.
import { Capacitor } from "@capacitor/core";
import { settleWithin } from "@/lib/promiseTimeout";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

type KeychainData = {
  getData: (o: { key: string }) => Promise<{ value: string }>;
  setData: (o: { key: string; value: string }) => Promise<void>;
  deleteData: (o: { key: string }) => Promise<void>;
};

const KEY_PREFIX = "pom.auth.";

// Supabase holds its auth lock while it reads/writes storage, so a native
// call that never answers would freeze sign-in, sign-up and session refresh.
const NATIVE_TIMEOUT_MS = 3000;

/** Loads the Keychain and runs one call on it, giving up after a few seconds. */
function withKeychain<T>(
  getKeychain: () => Promise<KeychainData | null>,
  run: (kc: KeychainData) => Promise<T>,
): Promise<T | undefined> {
  return settleWithin(
    getKeychain().then((kc) => (kc ? run(kc) : undefined)),
    NATIVE_TIMEOUT_MS,
    "Keychain call",
  );
}

async function keychain(): Promise<KeychainData | null> {
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    // IMPORTANT: never return a Capacitor plugin object from an async
    // function (or resolve any promise with it). The plugin is a Proxy that
    // turns every property into a native method, including `then`, so the
    // promise machinery treats it as a thenable, calls the non-existent
    // native "then" method, and the promise never settles. That is what made
    // email sign-in / sign-up spin forever on a fresh install (App Review):
    // Supabase's startup storage read awaited this and never finished.
    const kc = NativeBiometric as unknown as KeychainData;
    return {
      getData: (o) => kc.getData(o),
      setData: (o) => kc.setData(o),
      deleteData: (o) => kc.deleteData(o),
    };
  } catch {
    return null;
  }
}

export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** Storage adapter for supabase-js: localStorage, backed up to the iOS Keychain. */
export function keychainBackedStorage(
  local: Storage = localStorage,
  getKeychain: () => Promise<KeychainData | null> = keychain,
): AuthStorage {
  return {
    async getItem(key) {
      const value = local.getItem(key);
      if (value !== null) return value;
      try {
        const saved = (
          await withKeychain(getKeychain, (kc) => kc.getData({ key: KEY_PREFIX + key }))
        )?.value;
        if (!saved) return null;
        local.setItem(key, saved);
        return saved;
      } catch {
        return null; // nothing saved yet, or no Keychain in this build
      }
    },
    async setItem(key, value) {
      local.setItem(key, value);
      try {
        await withKeychain(getKeychain, (kc) => kc.setData({ key: KEY_PREFIX + key, value }));
      } catch {
        /* localStorage copy still stands */
      }
    },
    async removeItem(key) {
      local.removeItem(key);
      try {
        await withKeychain(getKeychain, (kc) => kc.deleteData({ key: KEY_PREFIX + key }));
      } catch {
        /* already gone */
      }
    },
  };
}
