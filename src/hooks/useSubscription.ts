import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';

export type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let env: 'sandbox' | 'live' | null = null;
    try { env = getStripeEnvironment(); } catch { env = null; }

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || !env) {
        if (!cancelled) { setSubscription(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('subscriptions')
        .select('plan,status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id')
        .eq('user_id', userId)
        .eq('environment', env)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setSubscription((data as SubscriptionRow | null) ?? null);
        setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, []);

  const isPro = (() => {
    if (!subscription) return false;
    const okStatus = subscription.status === 'active' || subscription.status === 'trialing';
    const stillInPeriod = !subscription.current_period_end || new Date(subscription.current_period_end) > new Date();
    return subscription.plan === 'pro' && okStatus && stillInPeriod;
  })();

  return { subscription, isPro, loading };
}
