import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsNativeIOS } from '@/hooks/useIsNativeIOS';
import { createPortalSession } from '@/utils/payments.functions';
import { verifyAppleTransaction } from '@/utils/appleIap.functions';
import { getStripeEnvironment } from '@/lib/stripe';
import { openUrl } from '@/lib/browser';
import { toast } from 'sonner';
import type { AppleProduct } from 'apple-iap';

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
  'Replacement reminders',
  'Track unlimited baby products',
  'Manual product entry',
  'All safety notifications',
];

const PRO_FEATURES = [
  'Milestone & moment tracking',
  'Custom reminder timing',
  'Share access with a co-parent or caregiver',
  'Barcode scanner for instant product entry',
  'Multi-child support',
  'Export & backup your data',
];

function PricingPage() {
  const navigate = useNavigate();
  const { isPro, subscription, loading } = useSubscription();
  const { checkout } = Route.useSearch();
  const isNativeIOS = useIsNativeIOS();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [portalLoading, setPortalLoading] = useState(false);
  const [applePurchasing, setApplePurchasing] = useState(false);
  const [appleRestoring, setAppleRestoring] = useState(false);
  const [appleProduct, setAppleProduct] = useState<AppleProduct | null>(null);

  useEffect(() => {
    if (checkout === 'success') {
      toast.success('Payment received — unlocking Pro features…');
      setCheckoutOpen(false);
    }
  }, [checkout]);

  // On iOS, show the actual App Store Connect price/trial instead of the
  // hardcoded copy below — Apple can localize or adjust the displayed
  // price by region/tax, so what StoreKit reports is the source of truth
  // once it's available. Silently keeps the hardcoded fallback if this
  // fails (e.g. the product isn't fully configured yet) rather than
  // blocking the whole pricing screen on it.
  useEffect(() => {
    if (!isNativeIOS) return;
    let cancelled = false;
    (async () => {
      try {
        const { AppleIAP } = await import('apple-iap');
        const product = await AppleIAP.getProduct();
        if (!cancelled) setAppleProduct(product);
      } catch {
        // Fall back to the hardcoded price/trial copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNativeIOS]);

  const handleAppleUpgrade = async () => {
    setApplePurchasing(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast.error('Please sign in to upgrade');
        return;
      }
      const { AppleIAP } = await import('apple-iap');
      const result = await AppleIAP.purchase({ appAccountToken: data.user.id });
      const verified = await verifyAppleTransaction({
        data: { transactionId: result.transactionId, environment: result.environment },
      });
      if ('error' in verified) throw new Error(verified.error);
      if (verified.plan === 'pro') {
        toast.success('Purchase complete — Pro unlocked!');
      } else {
        toast.error("Purchase went through but Pro isn't active yet — try Restore purchases below.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase failed';
      // userCancelled is Apple's own purchase-sheet dismissal, not a real
      // error — don't show a scary toast for someone just backing out.
      if (message !== 'Purchase cancelled') toast.error(message);
    } finally {
      setApplePurchasing(false);
    }
  };

  const handleAppleRestore = async () => {
    setAppleRestoring(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast.error('Please sign in first');
        return;
      }
      const { AppleIAP } = await import('apple-iap');
      const { transactions } = await AppleIAP.restorePurchases();
      if (transactions.length === 0) {
        toast('No previous purchases found for this Apple ID.');
        return;
      }
      for (const tx of transactions) {
        const verified = await verifyAppleTransaction({
          data: { transactionId: tx.transactionId, environment: tx.environment },
        });
        if ('error' in verified) throw new Error(verified.error);
      }
      toast.success('Purchases restored.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not restore purchases');
    } finally {
      setAppleRestoring(false);
    }
  };

  const handleUpgrade = async () => {
    if (isNativeIOS) {
      await handleAppleUpgrade();
      return;
    }
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
    // An Apple-originated subscription is managed through the App Store,
    // not Stripe's billing portal — Stripe has no record of it at all.
    if (subscription?.payment_provider === 'apple') {
      await openUrl('https://apps.apple.com/account/subscriptions');
      return;
    }
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: {
          returnUrl: window.location.href,
          environment: getStripeEnvironment(),
        },
      });
      if ('error' in result) throw new Error(result.error);
      await openUrl(result.url);
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
          <h2 className="text-3xl font-bold">Safety is free</h2>
          <p className="text-muted-foreground">
            Recall alerts and replacement reminders stay free of charge. Pro unlocks convenience features.
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
              <p className="text-sm text-muted-foreground">AI-assisted guidance & extended features</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{appleProduct?.displayPrice ?? '$3.33'}</div>
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
              <Button onClick={handleUpgrade} className="w-full" disabled={applePurchasing}>
                {applePurchasing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Start free trial'
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                7 days free, then {appleProduct?.displayPrice ?? '$3.33'}/month. Cancel anytime.
              </p>
              {isNativeIOS && (
                <Button
                  onClick={handleAppleRestore}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  disabled={appleRestoring}
                >
                  {appleRestoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore purchases
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Your subscription helps keep recall alerts free for every parent.
        </p>

        {/* Apple/App-review requirement: price, billing period, renewal
            terms, and Terms/Privacy links on or adjacent to the purchase
            screen. Was previously missing entirely — see COMPLIANCE_REPORT.md §5/§7. */}
        <p className="text-xs text-center text-muted-foreground">
          Pro is {appleProduct?.displayPrice ?? '$3.33'}/month after a 7-day free trial. Your
          subscription renews automatically each month until you cancel; cancel anytime from{' '}
          {isPro ? '"Manage subscription" above' : 'your account settings'} — no charge if you
          cancel before the trial ends.{' '}
          {isNativeIOS
            ? 'Payment is charged to your Apple ID account and managed entirely through the App Store.'
            : null}{' '}
          By subscribing you agree to our{' '}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
