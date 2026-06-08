import { useEffect, useState, useCallback } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

type GateRequest = { feature: string; description?: string } | null;

const listeners = new Set<(req: GateRequest) => void>();
let current: GateRequest = null;

function setCurrent(req: GateRequest) {
  current = req;
  listeners.forEach((l) => l(req));
}

export function useProGate() {
  const { isPro, loading } = useSubscription();

  const requirePro = useCallback((feature: string, description?: string): boolean => {
    if (isPro) return true;
    setCurrent({ feature, description });
    return false;
  }, [isPro]);

  return { isPro, loading, requirePro };
}

export function useProGateRequest(): [GateRequest, () => void] {
  const [req, setReq] = useState<GateRequest>(current);
  useEffect(() => {
    listeners.add(setReq);
    return () => { listeners.delete(setReq); };
  }, []);
  const dismiss = useCallback(() => setCurrent(null), []);
  return [req, dismiss];
}
