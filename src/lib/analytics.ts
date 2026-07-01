import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "./constants";

type EventName =
  | "app_opened"
  | "product_added"
  | "recall_alert_shown"
  | "milestone_completed"
  | "onboarding_completed"
  | "subscription_started";

type EventProperties = Record<string, string | number | boolean | null>;

export async function trackEvent(
  event: EventName,
  properties: EventProperties = {},
): Promise<void> {
  try {
    await (supabase as any).from("analytics_events").insert({
      event_name: event,
      properties,
      app_version: APP_VERSION,
    });
  } catch {
    // Analytics failures must never surface to the user
  }
}
