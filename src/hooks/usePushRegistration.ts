import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/sanitize-error";

/**
 * Registers this device for push notifications (native iOS builds only —
 * PushNotifications is a Capacitor plugin, a no-op on web) and stores the
 * resulting APNs device token on the user's profile so the daily push job
 * (product-alerts-check hook) can reach them. Call once from the
 * authenticated layout after a user is confirmed logged in.
 */
export function usePushRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
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

      const { PushNotifications } = await import("@capacitor/push-notifications");

      const permStatus = await PushNotifications.checkPermissions();
      let granted = permStatus.receive === "granted";
      if (!granted && permStatus.receive !== "denied") {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === "granted";
      }
      if (!granted || cancelled) return;

      listeners.push(
        await PushNotifications.addListener("registration", async (token) => {
          if (cancelled) return;
          await supabase
            .from("profiles")
            .update({ apns_device_token: token.value })
            .eq("user_id", userId);
        }),
      );
      listeners.push(
        await PushNotifications.addListener("registrationError", (err) => {
          logError("[push] registration error:", err.error);
        }),
      );

      // Tapping a recall push should land the user on the alerts screen.
      listeners.push(
        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const type = (action.notification.data as { type?: string } | undefined)?.type;
          window.location.assign(type === "recall" ? "/alerts" : "/home");
        }),
      );


      if (!cancelled) await PushNotifications.register();
    })();

    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
    };
  }, [userId]);
}
