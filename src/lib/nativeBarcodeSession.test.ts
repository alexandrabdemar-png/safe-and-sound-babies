import { describe, it, expect, vi } from "vitest";
import {
  normalizeBarcode,
  startBarcodeSession,
  type MlKitLike,
  type PermissionState,
} from "./nativeBarcodeSession";

function makeScanner(opts: {
  camera?: PermissionState;
  requested?: PermissionState;
  startThrows?: Error;
}) {
  let cb: ((e: { barcodes: Array<{ rawValue?: string }> }) => void) | null = null;
  const calls: string[] = [];
  const scanner: MlKitLike = {
    checkPermissions: async () => ({ camera: opts.camera ?? "granted" }),
    requestPermissions: async () => ({ camera: opts.requested ?? "denied" }),
    addListener: async (_event, fn) => {
      cb = fn;
      return {
        remove: async () => {
          calls.push("remove");
        },
      };
    },
    startScan: async () => {
      calls.push("startScan");
      if (opts.startThrows) throw opts.startThrows;
    },
    stopScan: async () => {
      calls.push("stopScan");
    },
  };
  return { scanner, calls, emit: (v?: string) => cb?.({ barcodes: [{ rawValue: v }] }) };
}

describe("normalizeBarcode", () => {
  it("strips the iOS EAN-13 leading zero back to UPC-A", () => {
    expect(normalizeBarcode("0047406191055")).toBe("047406191055");
  });
  it("leaves real 13-digit EANs alone", () => {
    expect(normalizeBarcode("8720874760276")).toBe("8720874760276");
  });
  it("leaves 12-digit UPCs alone", () => {
    expect(normalizeBarcode("047406191055")).toBe("047406191055");
  });
});

describe("startBarcodeSession", () => {
  it("starts the camera session and makes the WebView transparent", async () => {
    const { scanner, calls } = makeScanner({});
    const setTransparent = vi.fn();
    const session = await startBarcodeSession(scanner, [], {
      onDetected: () => {},
      setTransparent,
    });
    expect(session).not.toBeNull();
    expect(calls).toContain("startScan");
    expect(setTransparent).toHaveBeenCalledWith(true);
  });

  it("reports a detected code once, stopping the session first", async () => {
    const { scanner, calls, emit } = makeScanner({});
    const onDetected = vi.fn();
    const setTransparent = vi.fn();
    await startBarcodeSession(scanner, [], { onDetected, setTransparent });
    emit("0047406191055");
    emit("049796611571");
    await new Promise((r) => setTimeout(r, 0));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("047406191055");
    expect(calls).toContain("stopScan");
    expect(setTransparent).toHaveBeenLastCalledWith(false);
  });

  it("ignores empty scan events", async () => {
    const { scanner, emit } = makeScanner({});
    const onDetected = vi.fn();
    await startBarcodeSession(scanner, [], { onDetected, setTransparent: () => {} });
    emit(undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("requests permission when not yet granted and surfaces denial", async () => {
    const { scanner, calls } = makeScanner({ camera: "prompt", requested: "denied" });
    const onError = vi.fn();
    const session = await startBarcodeSession(scanner, [], {
      onDetected: () => {},
      onError,
      setTransparent: () => {},
    });
    expect(session).toBeNull();
    expect(onError).toHaveBeenCalled();
    expect(calls).not.toContain("startScan");
  });

  it("accepts limited (iOS restricted) camera access", async () => {
    const { scanner } = makeScanner({ camera: "limited" });
    const session = await startBarcodeSession(scanner, [], {
      onDetected: () => {},
      setTransparent: () => {},
    });
    expect(session).not.toBeNull();
  });

  it("restores the WebView and releases the camera if startScan fails", async () => {
    const { scanner, calls } = makeScanner({ startThrows: new Error("boom") });
    const setTransparent = vi.fn();
    await expect(
      startBarcodeSession(scanner, [], { onDetected: () => {}, setTransparent }),
    ).rejects.toThrow("boom");
    expect(calls).toContain("stopScan");
    expect(calls).toContain("remove");
    expect(setTransparent).toHaveBeenLastCalledWith(false);
  });

  it("stop() is idempotent", async () => {
    const { scanner, calls } = makeScanner({});
    const session = await startBarcodeSession(scanner, [], {
      onDetected: () => {},
      setTransparent: () => {},
    });
    await session!.stop();
    await session!.stop();
    expect(calls.filter((c) => c === "stopScan")).toHaveLength(1);
  });
});
