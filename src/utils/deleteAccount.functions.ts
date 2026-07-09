import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createStripeClient } from '@/lib/stripe.server';

/**
 * Fully delete the calling user's account:
 *  1. Cancel any live/sandbox Stripe subscriptions immediately (so a paying
 *     user is not billed again after "deleting").
 *  2. Delete the auth user via the admin API. Every public table with a
 *     user_id / caregiver_user_id FK to auth.users has ON DELETE CASCADE,
 *     so this wipes children, products, milestones, emergency_info,
 *     emergency_share_links, bottles, caregiver_access, profiles
 *     (apns_device_token), subscriptions, insight_dismissals, etc.
 */
export const deleteMyAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 1. Cancel Stripe subscriptions (both envs). Best-effort — a Stripe
    //    failure must not block account deletion; we surface it in the
    //    response so the client can warn the user.
    const stripeErrors: string[] = [];
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, environment, status')
      .eq('user_id', userId);

    for (const sub of subs ?? []) {
      const subId = (sub as { stripe_subscription_id: string | null }).stripe_subscription_id;
      const env = (sub as { environment: 'sandbox' | 'live' }).environment;
      const status = (sub as { status: string | null }).status;
      if (!subId) continue;
      if (status === 'canceled' || status === 'incomplete_expired') continue;
      try {
        const stripe = createStripeClient(env);
        await stripe.subscriptions.cancel(subId);
      } catch (e) {
        stripeErrors.push(e instanceof Error ? e.message : String(e));
      }
    }

    // 2. Delete the auth user — cascades to every public.* table.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true, stripeErrors };
  });
