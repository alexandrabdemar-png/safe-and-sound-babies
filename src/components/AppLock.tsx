import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { isNativeApp, verifyWithBiometrics } from "@/lib/nativeFeatures";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

// Face ID app lock (iPhone app only). Biometrics are checked by iOS on the
// device — the app only receives "verified / not verified", never face data.
const STORAGE_KEY = "pom.faceIdLock";
const RELOCK_AFTER_MS = 60_000;

export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setAppLockEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

export function AppLock() {
  const [locked, setLocked] = useState(false);
  const busy = useRef(false);
  const hiddenAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await verifyWithBiometrics("Unlock Peace of Mine");
    busy.current = false;
    setLocked(!ok);
  }, []);

  useEffect(() => {
    if (!isNativeApp() || !isAppLockEnabled()) return;
    setLocked(true);
    void unlock();

    let remove: (() => void) | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isAppLockEnabled()) return;
        if (!isActive) {
          hiddenAt.current = Date.now();
        } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
          hiddenAt.current = null;
          setLocked(true);
          void unlock();
        }
      });
      remove = () => void handle.remove();
    })();
    return () => remove?.();
  }, [unlock]);

  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Lock className="h-6 w-6 text-primary" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-foreground">Peace of Mine is locked</p>
        <p className="mt-1 font-body text-sm text-muted-foreground">Use Face ID or your passcode to continue.</p>
      </div>
      <button
        onClick={() => void unlock()}
        className="rounded-full bg-primary px-6 py-2.5 font-body text-sm font-medium text-primary-foreground"
      >
        Unlock
      </button>
      <button
        onClick={async () => {
          setAppLockEnabled(false);
          await supabase.auth.signOut();
          window.location.assign("/auth");
        }}
        className="font-body text-xs text-muted-foreground underline"
      >
        Sign out
      </button>
    </div>
  );
}

/** Profile setting to turn the Face ID lock on/off. Only shown in the iPhone app. */
export function AppLockSetting() {
  const [native, setNative] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
    setOn(isAppLockEnabled());
  }, []);
  if (!native) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="font-display text-sm font-semibold text-foreground">Face ID lock</p>
        <p className="font-body text-xs text-muted-foreground">Require Face ID when opening the app</p>
      </div>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          setAppLockEnabled(v);
        }}
        aria-label="Face ID lock"
      />
    </div>
  );
}
