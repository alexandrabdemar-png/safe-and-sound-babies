import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { useSubscription } from '@/hooks/useSubscription';
import { createPortalSession } from '@/utils/payments.functions';
import { getStripeEnvironment } from '@/lib/stripe';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/pricing')({
  ssr: false,
  component: PricingPage,
  head: () => ({ meta: [{ title: 'Pricing — Peace of Mine' }] }),
  validateSearch: (s: Record<string, unknown>): { checkout?: string } => ({
    checkout: typeof s.checkout === 'string' ? s.checkout : undefined,
  }),
});

const FREE_FEATURES = [
  'Product recall alerts (with push notifications)',
  'Replacement & size-up reminders',
  'Track unlimited baby products',
  'Manual product entry',
  'All safety notifications',
];

const PRO_FEATURES = [
  'Everything in free, plus expert features, tips and tricks, safety insights, and pediatrician-reviewed guidance.',
  'Barcode scanner for instant product entry',
  'Multi-child support',
  'Export & backup your data',
  'Advanced insights (growth charts, spending)',
];

function PricingPage() {
  const navigate = useNavigate();
  const { isPro, subscription, loading } = useSubscription();
  const { checkout } = Route.useSearch();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (checkout === 'success') {
      toast.success('Payment received — unlocking Pro features…');
      setCheckoutOpen(false);
    }
  }, [checkout]);


  const handleUpgrade = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast.error('Please sign in to upgrade');
      return;
    }
    setUserEmail(data.user.email);
    setUserId(data.user.id);
    setCheckoutOpen(true);
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: {
          returnUrl: window.location.href,
          environment: getStripeEnvironment(),
        },
      });
      if ('error' in result) throw new Error(result.error);
      window.open(result.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  if (checkoutOpen) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto p-4">
          <Button variant="ghost" onClick={() => setCheckoutOpen(false)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to pricing
          </Button>
          <StripeEmbeddedCheckout
            priceId="pro_monthly"
            customerEmail={userEmail}
            userId={userId}
            returnUrl={`${window.location.origin}/pricing?checkout=success`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PaymentTestModeBanner />
      <header className="max-w-2xl mx-auto p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/home' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Plans</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2 pt-4">
          <h2 className="text-3xl font-bold">Safety is always free</h2>
          <p className="text-muted-foreground">
            Recall alerts and replacement reminders never go behind a paywall. Pro unlocks convenience features for power users.
          </p>
          <p className="font-body text-xs text-muted-foreground/70">
            Safety guidelines based on AAP recommendations.
          </p>
        </div>

        {/* Free plan */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="text-sm text-muted-foreground">Core safety features</p>
            </div>
            <div className="text-2xl font-bold">$0</div>
          </div>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="text-sm text-muted-foreground border-t pt-3">You're on this plan.</div>
          )}
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border-2 border-primary bg-card p-6 space-y-4 relative">
          <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Pro
          </div>
          <div className="flex items-baseline justify-between pt-2">
            <div>
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="text-sm text-muted-foreground">Expert features & guidance</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">$3.33</div>
              <div className="text-xs text-muted-foreground">per month</div>
              <div className="text-xs text-primary font-medium">7-day free trial</div>
            </div>
          </div>
          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {loading ? (
            <Button disabled className="w-full"><Loader2 className="h-4 w-4 animate-spin" /></Button>
          ) : isPro ? (
            <div className="space-y-2">
              <div className="text-sm text-center text-green-700 font-medium">
                You're on Pro
                {subscription?.cancel_at_period_end && subscription.current_period_end && (
                  <span className="block text-xs text-muted-foreground font-normal">
                    Cancels {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Button onClick={handleManage} variant="outline" className="w-full" disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage subscription'}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Button onClick={handleUpgrade} className="w-full">Start free trial</Button>
              <p className="text-xs text-center text-muted-foreground">7 days free, then $3.33/month. Cancel anytime.</p>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Your subscription helps keep recall alerts free for every parent.
        </p>
      </div>
    </div>
  );
}
