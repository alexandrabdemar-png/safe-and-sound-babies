import { describe, expect, it, vi } from "vitest";
import { keychainBackedStorage } from "./nativeAuthStorage";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

function fakeKeychain() {
  const m = new Map<string, string>();
  return {
    store: m,
    getData: vi.fn(async ({ key }: { key: string }) => {
      if (!m.has(key)) throw new Error("not found");
      return { value: m.get(key)! };
    }),
    setData: vi.fn(
      async ({ key, value }: { key: string; value: string }) => void m.set(key, value),
    ),
    deleteData: vi.fn(async ({ key }: { key: string }) => void m.delete(key)),
  };
}

describe("keychainBackedStorage", () => {
  it("restores the login from the Keychain after iOS clears localStorage", async () => {
    const local = memoryStorage();
    const kc = fakeKeychain();
    const storage = keychainBackedStorage(local, async () => kc);

    await storage.setItem("sb-auth-token", '{"access_token":"a"}');
    local.clear(); // iOS wiped the web view's storage

    expect(await storage.getItem("sb-auth-token")).toBe('{"access_token":"a"}');
    expect(local.getItem("sb-auth-token")).toBe('{"access_token":"a"}');
  });

  it("prefers localStorage and doesn't touch the Keychain when it has the value", async () => {
    const local = memoryStorage();
    const kc = fakeKeychain();
    local.setItem("k", "local");
    const storage = keychainBackedStorage(local, async () => kc);
    expect(await storage.getItem("k")).toBe("local");
    expect(kc.getData).not.toHaveBeenCalled();
  });

  it("signing out removes both copies so the login can't come back", async () => {
    const local = memoryStorage();
    const kc = fakeKeychain();
    const storage = keychainBackedStorage(local, async () => kc);
    await storage.setItem("k", "v");
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
    expect(kc.store.size).toBe(0);
  });

  it("falls back to plain localStorage when the Keychain isn't available", async () => {
    const local = memoryStorage();
    const storage = keychainBackedStorage(local, async () => {
      throw new Error("plugin not implemented");
    });
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
    local.clear();
    expect(await storage.getItem("k")).toBeNull();
  });
});
