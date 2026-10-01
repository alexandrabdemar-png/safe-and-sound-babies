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

async function keychain(): Promise<KeychainData | null> {
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    return NativeBiometric as unknown as KeychainData;
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
        const kc = await getKeychain();
        const saved = kc ? (await kc.getData({ key: KEY_PREFIX + key })).value : "";
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
        await (await getKeychain())?.setData({ key: KEY_PREFIX + key, value });
      } catch {
        /* localStorage copy still stands */
      }
    },
    async removeItem(key) {
      local.removeItem(key);
      try {
        await (await getKeychain())?.deleteData({ key: KEY_PREFIX + key });
      } catch {
        /* already gone */
      }
    },
  };
}
