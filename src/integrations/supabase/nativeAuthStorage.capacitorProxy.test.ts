import { describe, expect, it, vi } from "vitest";

// Regression test for App Review rejection (Guideline 2.1(a), Nov 2026):
// email sign-in / sign-up spun forever on a fresh install.
//
// Capacitor plugins are Proxies that turn *every* property into a native
// method — including `then`. Returning one from an async function makes the
// promise machinery call `plugin.then(resolve, reject)`, which goes to a
// non-existent native method and never calls resolve/reject, so the promise
// never settles. This fake reproduces that behaviour.
function capacitorLikePlugin(methods: Record<string, (...args: never[]) => unknown>) {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "$$typeof") return undefined;
        if (typeof prop === "string" && prop in methods) return methods[prop];
        // Unknown native method: Capacitor's wrapper returns a promise the
        // thenable protocol ignores, so resolve/reject are never called.
        return () => new Promise(() => {});
      },
    },
  );
}

const store = new Map<string, string>();

vi.mock("@capgo/capacitor-native-biometric", () => ({
  NativeBiometric: capacitorLikePlugin({
    getData: async ({ key }: { key: string }) => {
      if (!store.has(key)) throw new Error("not found");
      return { value: store.get(key)! };
    },
    setData: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    deleteData: async ({ key }: { key: string }) => void store.delete(key),
  }),
}));

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

function settlesQuickly<T>(p: Promise<T>, ms = 1000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("hung")), ms)),
  ]);
}

describe("keychainBackedStorage with the real Capacitor plugin shape", () => {
  it("fresh install: reading an empty session returns null instead of hanging", async () => {
    const { keychainBackedStorage } = await import("./nativeAuthStorage");
    const storage = keychainBackedStorage(memoryStorage());
    await expect(
      settlesQuickly(Promise.resolve(storage.getItem("sb-auth-token"))),
    ).resolves.toBeNull();
  });

  it("saving, restoring and removing a session all complete", async () => {
    const { keychainBackedStorage } = await import("./nativeAuthStorage");
    const local = memoryStorage();
    const storage = keychainBackedStorage(local);
    await settlesQuickly(Promise.resolve(storage.setItem("k", "v")));
    local.clear();
    await expect(settlesQuickly(Promise.resolve(storage.getItem("k")))).resolves.toBe("v");
    await settlesQuickly(Promise.resolve(storage.removeItem("k")));
    expect(store.size).toBe(0);
  });

  it("a native call that never answers can't block auth forever", async () => {
    vi.useFakeTimers();
    try {
      const { keychainBackedStorage } = await import("./nativeAuthStorage");
      const hanging = {
        getData: () => new Promise<never>(() => {}),
        setData: vi.fn(),
        deleteData: vi.fn(),
      };
      const storage = keychainBackedStorage(memoryStorage(), async () => hanging);
      const read = Promise.resolve(storage.getItem("k"));
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(read).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
