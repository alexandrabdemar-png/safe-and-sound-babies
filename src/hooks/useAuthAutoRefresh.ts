import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps Supabase's session-refresh timer in sync with the native app's
 * foreground/background state (native only — no-op on web).
 *
 * supabase-js refreshes the access token via a setTimeout-based timer, but
 * iOS suspends JS timers while the app is backgrounded. Per Supabase's own
 * guidance for mobile apps (startAutoRefresh/stopAutoRefresh), without this
 * the timer can miss its window while the app is closed, so the stored
 * session looks expired by the time the app is reopened — the user sees
 * this as "I have to log in every time I close and reopen the app," even
 * though the session was persisted correctly the whole time.
 */
export function useAuthAutoRefresh() {
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

      void supabase.auth.startAutoRefresh();

      listeners.push(
        await App.addListener("appStateChange", ({ isActive }) => {
          if (cancelled) return;
          if (isActive) void supabase.auth.startAutoRefresh();
          else void supabase.auth.stopAutoRefresh();
        }),
      );
    })();

    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
    };
  }, []);
}
