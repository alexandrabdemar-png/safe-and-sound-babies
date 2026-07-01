/**
 * pushNotifications.ts — Client-side push notification registration.
 *
 * On native (iOS/Android via Capacitor):
 *   - Requests permission
 *   - Registers with APNs/FCM
 *   - Saves the device token to profiles.expo_push_token
 *
 * On web (PWA):
 *   - Checks for Web Push API support
 *   - Registers service worker push subscription
 *   - Saves the serialised subscription to profiles.expo_push_token
 *     (reusing the same column so the server-side sender works unchanged)
 *
 * iOS Critical Alert note:
 *   Critical alerts play sound and bypass Do Not Disturb even when the user
 *   has turned off notifications. They require an Apple entitlement that must
 *   be requested via https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
 *   Once approved, set criticalAlert: true in the Capacitor PushNotifications
 *   plugin config and re-submit to the App Store.
 */

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// ── Native (Capacitor iOS / Android) ─────────────────────────────────────────

async function registerNative(): Promise<void> {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const current = await PushNotifications.checkPermissions();
  let status = current.receive;

  if (status === "prompt" || status === "prompt-with-rationale") {
    const requested = await PushNotifications.requestPermissions();
    status = requested.receive;
  }

  if (status !== "granted") {
    console.info("[push] permission not granted:", status);
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    await saveToken(token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] registration error:", err.error);
  });

  // Handle recall taps while app is open or in background
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as Record<string, string> | undefined;
    if (data?.type === "recall") {
      window.location.href = "/alerts";
    }
  });
}

// ── Web Push (PWA) ────────────────────────────────────────────────────────────

async function registerWeb(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.info("[push] Web Push not supported");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.info("[push] web notification permission denied");
    return;
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY not set — web push unavailable");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    // Serialise as JSON and store in the same column the server already reads
    await saveToken(JSON.stringify(sub.toJSON()));
  } catch (e) {
    console.warn("[push] web push subscribe failed:", e);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ── Common ────────────────────────────────────────────────────────────────────

async function saveToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any)
      .from("profiles")
      .upsert({ user_id: user.id, expo_push_token: token }, { onConflict: "user_id" });
    console.info("[push] token saved");
  } catch (e) {
    console.warn("[push] failed to save token:", e);
  }
}

/**
 * Call this once after the user signs in.
 * Safe to call on every app start — it short-circuits if already registered.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await registerNative();
    } else {
      await registerWeb();
    }
  } catch (e) {
    // Push registration is best-effort — never throw to the caller
    console.warn("[push] registration failed:", e);
  }
}
