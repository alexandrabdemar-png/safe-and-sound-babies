import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchRecentBabyRecalls } from '@/lib/cpscSearch';
import { mapCpscResults, mapCriticalRecalls, mapExtraResults, mergeRecallSources, classifyRecallFetchStatus, filterDismissedRecalls, type ExtraRecallRow } from '@/lib/recallRadarMerge';
import { settleWithin } from '@/lib/promiseTimeout';

export const recallRadarQueryOptions = (userId: string) => queryOptions({
  queryKey: ['recall-radar', userId],
  staleTime: 5 * 60 * 1000,
  retry: false,
  queryFn: async () => {
    const [recent, stored, dismissed] = await Promise.allSettled([
      settleWithin(fetchRecentBabyRecalls(30), 10000, 'Recent recalls'),
      settleWithin(Promise.resolve(supabase.from('recalls').select('id, source, title, description, hazard, url, recall_date, official, lot_pattern').order('recall_date', { ascending: false }).limit(100)), 10000, 'Saved recalls'),
      settleWithin(Promise.resolve(supabase.from('recall_radar_dismissals').select('recall_id').eq('user_id', userId)), 10000, 'Reviewed recalls'),
    ]);
    if (dismissed.status === 'rejected' || dismissed.value.error) throw new Error("Couldn't load your reviewed recalls. Please try again.");
    const merged = mergeRecallSources(
      mapCriticalRecalls(),
      recent.status === 'fulfilled' ? mapCpscResults(recent.value) : [],
      stored.status === 'fulfilled' && !stored.value.error ? mapExtraResults((stored.value.data ?? []) as ExtraRecallRow[]) : [],
    );
    const status = classifyRecallFetchStatus(recent.status === 'rejected', stored.status === 'rejected' || Boolean(stored.value.error), merged.length);
    const dismissedIds = new Set(dismissed.value.data?.map(r => r.recall_id));
    return { recalls: merged, visibleRecalls: filterDismissedRecalls(merged, dismissedIds), dismissedIds, ...status };
  },
});