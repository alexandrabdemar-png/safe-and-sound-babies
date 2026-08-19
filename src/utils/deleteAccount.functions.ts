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

    // 2. Delete the user's uploaded product photos. Storage objects are NOT
    //    covered by the auth.users cascade, so without this they'd survive
    //    account deletion as orphans (and our privacy policy promises they
    //    don't). Every upload path is `<uid>/...` (enforced by the
    //    product-photos INSERT policy), so listing that prefix is exhaustive.
    //    Best-effort: a storage failure must not block account deletion.
    const storageErrors: string[] = [];
    try {
      const paths: string[] = [];
      const { data: folders } = await supabaseAdmin.storage
        .from('product-photos')
        .list(userId, { limit: 1000 });
      for (const entry of folders ?? []) {
        // Uploads live one level deeper (`<uid>/<barcode-or-id>/<file>`), but
        // handle a flat `<uid>/<file>` layout too.
        if (entry.id === null) {
          const { data: files } = await supabaseAdmin.storage
            .from('product-photos')
            .list(`${userId}/${entry.name}`, { limit: 1000 });
          for (const file of files ?? []) paths.push(`${userId}/${entry.name}/${file.name}`);
        } else {
          paths.push(`${userId}/${entry.name}`);
        }
      }
      if (paths.length > 0) {
        const { error: rmError } = await supabaseAdmin.storage
          .from('product-photos')
          .remove(paths);
        if (rmError) storageErrors.push(rmError.message);
      }
    } catch (e) {
      storageErrors.push(e instanceof Error ? e.message : String(e));
    }

    // 3. Delete the auth user — cascades to every public.* table.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true, stripeErrors, storageErrors };

  });
