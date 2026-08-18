/**
 * Server-side Pro subscription gate, shared by every TanStack server
 * function that needs to enforce a paid feature authoritatively (i.e. not
 * just via the client-side useProGate() UI check, which a user could bypass
 * by calling the server function directly with their own session).
 *
 * Reads from the subscriptions table via the caller's own authenticated
 * client, so RLS ("Users view own subscription") already scopes this to
 * their own row — no service-role client needed here.
 *
 * `supabase` is loosely typed (rather than SupabaseClient<Database>) so
 * this stays easy to exercise with a mocked query-builder chain in tests,
 * matching the equivalent edge-function-side gate in
 * supabase/functions/_shared/subscription.ts.
 */
export async function hasProSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  if (!data) return false;
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
    return false;
  }
  return true;
}
