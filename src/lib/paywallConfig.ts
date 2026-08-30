/**
 * Temporary, whole-app paywall bypass — while true, every user (the public
 * website included, not just the TestFlight app) is treated as Pro
 * regardless of subscription status, and nobody sees an upgrade prompt.
 *
 * Turned on at the user's request so TestFlight beta testers can try every
 * feature for free during the beta. There's no way to scope this to "just
 * the native app" server-side — a client-supplied "I'm the TestFlight app"
 * flag can't be trusted, since anyone could send the same flag from a
 * browser. MUST be flipped back to `false` before public launch, or the
 * app stops charging anyone.
 *
 * Checked by src/hooks/useSubscription.ts (client UI) and
 * src/lib/serverProGate.ts (server functions — the authoritative gate).
 * Supabase edge functions (lookup-product, send-caregiver-invite) can't
 * import from src/, so they check their own copy in
 * supabase/functions/_shared/paywallConfig.ts — keep both in sync.
 */
export const PAYWALL_DISABLED = true;
