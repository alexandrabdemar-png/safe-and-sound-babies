import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { createCheckoutSession } from '@/utils/payments.functions';
import { isNativeApp } from '@/lib/isNativeApp';

interface Props {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, quantity, customerEmail, userId, returnUrl }: Props) {
  // Apple 3.1.1: web checkout must never render inside the App Store app.
  if (isNativeApp()) {
    return (
      <p role="alert" className="text-sm text-center text-muted-foreground py-8">
        Subscriptions in the app are purchased through the App Store.
      </p>
    );
  }

  const fetchClientSecret = async (): Promise<string> => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        quantity,
        returnUrl: returnUrl || window.location.href,
        environment: getStripeEnvironment(),
      },
    });
    if ('error' in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error('Stripe did not return a client secret');
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
