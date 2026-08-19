import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError } from "@/lib/sanitize-error";

export type ChildOption = {
  id: string;
  name: string;
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
    const { data, error } = await supabase
      .from('children')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (error) {
      // Log it and leave the existing list untouched rather than silently
      // replacing a previously-successful fetch with an empty one, which
      // would make the app think the user's children just disappeared.
      logError('[useActiveChild] failed to load children', error);
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
