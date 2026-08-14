/**
 * Browser Web Push — the web app's equivalent of the native app's APNs
 * registration (src/lib/apns.server.ts), for users who use this app in a
 * browser rather than through the Capacitor-wrapped native build. Delivery
 * on the server side lives in supabase/functions/_shared/webPush.ts; this
 * file only handles the browser-side subscribe/unsubscribe flow and
 * upserting the subscription into web_push_subscriptions (RLS-scoped to
 * the signed-in user — see supabase/migrations/20260814120000_*.sql).
 */
import { supabase } from "@/integrations/supabase/client";

export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type SubscribeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "not_configured"
        | "not_signed_in"
        | "permission_denied"
        | "save_failed";
    };

/**
 * Requests notification permission, subscribes via PushManager using the
 * VAPID public key, and upserts the subscription for the signed-in user.
 * Safe to call again for an already-subscribed browser — reuses the
 * existing PushSubscription and upserts on endpoint, so it's idempotent.
 */
export async function subscribeToWebPush(): Promise<SubscribeResult> {
  if (!isWebPushSupported()) return { ok: false, reason: "unsupported" };

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) return { ok: false, reason: "not_configured" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return { ok: false, reason: "not_signed_in" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission_denied" };

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "save_failed" };
  }

  const { error } = await (supabase as any).from("web_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: "save_failed" };

  return { ok: true };
}

/** True if this browser currently holds a live PushSubscription. */
export async function getWebPushSubscriptionStatus(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return Boolean(subscription);
}

export async function unsubscribeFromWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await (supabase as any).from("web_push_subscriptions").delete().eq("endpoint", endpoint);
}
