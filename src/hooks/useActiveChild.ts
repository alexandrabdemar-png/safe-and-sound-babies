import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isColumnUnavailableError } from '@/lib/errors';

export type ChildOption = {
  id: string;
  name: string;
  date_of_birth: string | null;
  due_date: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  measurements_updated_at: string | null;
};

const STORAGE_KEY = 'safesound.activeChildId';
const listeners = new Set<() => void>();

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setActiveChildId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function useActiveChild() {
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(readStored());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let { data, error } = await supabase
      .from('children')
      .select('id, name, date_of_birth, due_date, height_inches, weight_lbs, measurements_updated_at')
      .order('created_at', { ascending: true });

    // due_date is a recent addition — if a migration hasn't reached this
    // database yet, the WHOLE select fails (not just that column), which
    // previously collapsed the entire children list to [] silently (error
    // was discarded entirely) and made every screen using this hook —
    // Moments, Products, Profile, Home — claim the user had no children
    // at all, even right after successfully saving one. Retry without
    // due_date rather than losing the whole list, same pattern already
    // used for the same column in onboarding.tsx.
    if (error && isColumnUnavailableError('due_date', error)) {
      console.error('[useActiveChild] children.due_date unavailable — retrying without it', error);
      const retry = await supabase
        .from('children')
        .select('id, name, date_of_birth, height_inches, weight_lbs, measurements_updated_at')
        .order('created_at', { ascending: true });
      data = (retry.data?.map((c) => ({ ...c, due_date: null })) ?? null) as typeof data;
      error = retry.error;
    }

    if (error) {
      // Any other failure (network blip, transient auth hiccup, etc.) —
      // log it and leave the existing list untouched rather than silently
      // replacing a previously-successful fetch with an empty one, which
      // would make the app think the user's children just disappeared.
      console.error('[useActiveChild] failed to load children', error);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as ChildOption[];
    setChildren(list);
    setLoading(false);
    // Ensure selection is valid
    const stored = readStored();
    if (stored && list.some((c) => c.id === stored)) {
      setActiveIdState(stored);
    } else if (list.length) {
      setActiveIdState(list[0].id);
      setActiveChildId(list[0].id);
    } else {
      setActiveIdState(null);
    }
  }, []);


  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onChange = () => setActiveIdState(readStored());
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, []);

  const activeChild = children.find((c) => c.id === activeId) ?? null;
  return { children, activeChild, activeChildId: activeId, setActiveChildId, refresh, loading };
}
