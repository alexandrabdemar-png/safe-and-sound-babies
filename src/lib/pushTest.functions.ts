import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendTestPushResult = { ok: true } | { ok: false; reason: "no_token" | string };

/**
 * Sends a one-off push to the calling user's own registered device token —
 * lets someone self-check "are push notifications actually working on my
 * phone?" from Notification Settings, without waiting for a real recall or
 * expiration alert to happen to trigger one.
 */
export const sendTestPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SendTestPushResult> => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("apns_device_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    const token = (profile as { apns_device_token: string | null } | null)?.apns_device_token;
    if (!token) return { ok: false, reason: "no_token" };

    const { sendApnsPush } = await import("@/lib/apns.server");
    const result = await sendApnsPush(token, {
      title: "Peace of Mine",
      body: "Test notification — if you're seeing this, push notifications are working.",
    });
    return result.ok
      ? { ok: true }
      : { ok: false, reason: result.reason ?? `http_${result.status}` };
  });
