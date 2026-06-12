import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { type StripeEnv, verifyWebhook } from '@/lib/stripe.server';
import { sanitizeError } from '@/lib/sanitize-error';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}
function subs() {
  return getSupabase().from('subscriptions') as any;
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const plan = priceId === 'pro_monthly' ? 'pro' : 'free';

  await subs().upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      plan,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  // Keep plan='pro' while inside the paid/trial period; downgrade only once it lapses.
  const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
  const stillInPeriod = !periodEndDate || periodEndDate > new Date();
  const isProPrice = priceId === 'pro_monthly';
  const isTrialing = subscription.status === 'trialing';
  const plan = (isProPrice || isTrialing) && stillInPeriod ? 'pro' : 'free';

  await subs()
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      plan,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEndDate?.toISOString() ?? null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
    .eq('environment', env);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  // Preserve plan & period_end so the user keeps Pro until current_period_end.
  // The useSubscription hook treats canceled+future period_end as Pro.
  const periodEnd = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
  const stillInPeriod = !!(periodEndDate && periodEndDate > new Date());

  await subs()
    .update({
      status: 'canceled',
      plan: stillInPeriod ? 'pro' : 'free',
      ...(periodEndDate && { current_period_end: periodEndDate.toISOString() }),
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
    .eq('environment', env);
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  // Only handle subscription checkouts
  if (session.mode !== 'subscription') return;
  const userId = session.metadata?.userId;
  if (!userId) return;

  // The subscription object may not be expanded here; we record what we have
  // so the user gets Pro access immediately. customer.subscription.created
  // will upsert the full record shortly after.
  const subscriptionId = session.subscription;
  if (!subscriptionId) return;

  await subs().upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer,
      plan: 'pro',
      status: 'trialing',
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object, env);
      break;
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      break;
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          console.error('Webhook received with invalid env:', rawEnv);
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error('[webhook] error:', sanitizeError(e));
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
