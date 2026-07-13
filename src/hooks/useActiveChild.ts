import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    const { data } = await supabase
      .from('children')
      .select('id, name, date_of_birth, due_date, height_inches, weight_lbs, measurements_updated_at')
      .order('created_at', { ascending: true });
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
