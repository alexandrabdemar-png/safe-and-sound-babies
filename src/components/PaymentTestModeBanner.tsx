import { useEffect, useState } from 'react';
import { isPreviewHost } from '@/lib/previewHost';
import { isNativeApp } from '@/lib/isNativeApp';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

// Only shown in the Lovable preview / localhost. Never in the iPhone app or
// published site: App Review flags test-mode notices as beta features (2.2).
export function PaymentTestModeBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(isPreviewHost(window.location.hostname) && !isNativeApp());
  }, []);
  if (!show) return null;
  if (!clientToken) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Production checkout is not configured. Complete Stripe go-live in your Lovable project to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith('pk_test_')) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
        All payments made in the preview are in test mode. If checkout asks for a texted code, use Stripe's test code: 000000.{' '}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          Read more
        </a>
      </div>
    );
  }
  return null;
}
