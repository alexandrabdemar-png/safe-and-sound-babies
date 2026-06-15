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

function computeIsPro(sub: SubscriptionRow | null): boolean {
  if (!sub || sub.plan !== 'pro') return false;
  const stillInPeriod = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  const okStatus = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  // End-of-period access: canceled but period not over yet
  const inGracePeriod = sub.status === 'canceled' && stillInPeriod;
  return (okStatus && stillInPeriod) || inGracePeriod;
}

export function useSubscription() {
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
      const { data } = await supabase
        .from('subscriptions')
        .select('plan,status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id')
        .eq('user_id', userIdLocal)
        .eq('environment', env)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setSubscription((data as SubscriptionRow | null) ?? null);
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

      channel = supabase
        .channel(`subscriptions:${userIdLocal}`)
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

return { subscription, isPro: true, loading }
