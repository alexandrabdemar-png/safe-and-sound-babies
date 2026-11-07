import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { settleWithin } from '@/lib/promiseTimeout';

export function PageLoadError({ reset }: Partial<ErrorComponentProps>) {
  const router = useRouter();
  return <div role="alert" className="mx-auto max-w-md px-6 py-16 text-center">
    <h1 className="font-display text-xl">This page couldn't load</h1>
    <p className="mt-3 text-sm text-muted-foreground">Check your connection and try again. Your saved information hasn't changed.</p>
    <Button className="mt-5" onClick={() => { void router.invalidate(); reset?.(); }}>Try again</Button>
  </div>;
}

export function PagePending() {
  const [expired, setExpired] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setExpired(true), 15000); return () => clearTimeout(timer); }, []);
  return expired ? <PageLoadError /> : <p className="p-8 text-center text-muted-foreground" role="status">Loading…</p>;
}

/** Bounds every browser fetch, including server functions and third-party reads. */
export function PageReliability({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const original = window.fetch;
    const bounded: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const auth = url.includes('/auth/v1/');
      const controller = new AbortController();
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        // Image analysis legitimately takes longer than small page reads.
        const ms = auth ? 10000 : /receipt|image|ai-advice/.test(url) ? 60000 : 15000;
        return await settleWithin(original.call(window, input, { ...init, signal: controller.signal }), ms, 'Request');
      } catch (error) {
        if (error instanceof Error && /timed out/i.test(error.message)) {
          abort();
          if (!auth) setFailed(true);
        }
        throw error;
      } finally { signal?.removeEventListener('abort', abort); }
    };
    window.fetch = bounded;
    const unsub = router.subscribe('onResolved', () => setFailed(false));
    return () => { window.fetch = original; unsub(); };
  }, [router]);
  if (failed) return <div role="alert" className="mx-auto max-w-md px-6 py-16 text-center">
    <h1 className="font-display text-xl">This page took too long to load</h1>
    <p className="mt-3 text-sm text-muted-foreground">Check your connection, then try again.</p>
    <Button className="mt-5" onClick={() => window.location.reload()}>Try again</Button>
  </div>;
  return children;
}