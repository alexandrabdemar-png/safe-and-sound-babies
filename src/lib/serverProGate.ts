import { hasAnyProSubscription, type ProSubscriptionRow } from "@/lib/isPro";
import { PAYWALL_DISABLED } from "@/lib/paywallConfig";

/**
 * Server-side Pro subscription gate, shared by every TanStack server
 * function that needs to enforce a paid feature authoritatively (i.e. not
 * just via the client-side useProGate() UI check, which a user could bypass
 * by calling the server function — or the table — directly with their own
 * session).
 *
 * Reads from the subscriptions table via the caller's own authenticated
 * client, so RLS ("Users view own subscription") already scopes this to
 * their own rows — no service-role client needed here.
 *
 * The Pro decision itself lives in src/lib/isPro.ts so this cannot drift
 * from the UI's answer again. Every row for the user is considered (a user
 * can have both a sandbox and a live Stripe row); Pro is granted if any
 * row currently qualifies, matching the edge-function gate.
 *
 * `supabase` is loosely typed (rather than SupabaseClient<Database>) so
 * this stays easy to exercise with a mocked query-builder chain in tests.
 */
export async function hasProSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  if (PAYWALL_DISABLED) return true;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId);
  if (error || !data) return false;
  return hasAnyProSubscription(data as ProSubscriptionRow[]);
}
