import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';
import { computeIsPro } from '@/lib/isPro';
import { PAYWALL_DISABLED } from '@/lib/paywallConfig';

export type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
  payment_provider: string | null;
};


export function useSubscription() {
  // VITE_FORCE_PRO=true in .env.local bypasses the paywall for local dev;
  // PAYWALL_DISABLED (src/lib/paywallConfig.ts) bypasses it app-wide.
  if (import.meta.env.VITE_FORCE_PRO === 'true' || PAYWALL_DISABLED) {
    return {
      subscription: {
        plan: 'pro',
        status: 'active',
        price_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
        stripe_customer_id: null,
        payment_provider: 'stripe',
      } as SubscriptionRow,
      isPro: true,
      loading: false,
    };
  }

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let env: 'sandbox' | 'live' | null = null;
    try { env = getStripeEnvironment(); } catch { env = null; }
    let userIdLocal: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refetch() {
      if (!userIdLocal || !env) return;
      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          'plan,status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id,payment_provider',
        )
        .eq('user_id', userIdLocal)
        .eq('environment', env)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Never downgrade a paying customer because of a transient/schema
        // query failure — keep whatever we already know and surface the error.
        console.error('[useSubscription] subscription lookup failed', error.message);
        return;
      }
      setSubscription((data as SubscriptionRow | null) ?? null);
    }

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      userIdLocal = userData.user?.id ?? null;
      if (!userIdLocal || !env) {
        if (!cancelled) { setSubscription(null); setLoading(false); }
        return;
      }
      await refetch();
      if (!cancelled) setLoading(false);

      // Unique suffix: reusing a channel name returns the already-subscribed
      // channel, and adding listeners to it throws "cannot add
      // postgres_changes callbacks ... after subscribe()".
      channel = supabase
        .channel(`subscriptions:${userIdLocal}:${Math.random().toString(36).slice(2)}`)

        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'subscriptions',
          filter: `user_id=eq.${userIdLocal}`,
        }, () => { refetch(); })
        .subscribe();
    }
    load();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { subscription, isPro: computeIsPro(subscription), loading };
}
