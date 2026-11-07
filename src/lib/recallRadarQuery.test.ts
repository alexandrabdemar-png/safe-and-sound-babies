import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rows: [] as unknown[], dismissals: [] as { recall_id: string }[], recent: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const chain = { select: () => chain, order: () => chain, limit: () => chain, eq: () => chain, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'recalls' ? mocks.rows : mocks.dismissals, error: null }).then(resolve) };
  return chain;
} } }));
vi.mock('@/lib/cpscSearch', () => ({ fetchRecentBabyRecalls: async () => mocks.recent }));
vi.mock('@/lib/recallCheck', () => ({ CRITICAL_RECALLS: [] }));
import { recallRadarQueryOptions } from './recallRadarQuery';

describe('one shared Recall Radar result', () => {
  it('counts exactly the deduplicated, unreviewed list including stored recalls', async () => {
    mocks.recent = [{ RecallID: '1', RecallHeading: 'Baby seat recall', RecallDate: '2026-11-07', URL: 'https://cpsc.gov/Recalls' }];
    mocks.rows = [
      { id: '1', source: 'cpsc', title: 'Baby seat recall', recall_date: '2026-11-07', official: true },
      { id: '2', source: 'fda', title: 'Infant formula recall', recall_date: '2026-11-06', official: true },
    ];
    mocks.dismissals = [{ recall_id: 'cpsc-1' }];
    const options = recallRadarQueryOptions('family-a');
    const fn = options.queryFn;
    if (typeof fn !== 'function') throw new Error('Missing recall query');
    const result = await fn({} as Parameters<typeof fn>[0]);
    expect(result.recalls).toHaveLength(2);
    expect(result.visibleRecalls).toHaveLength(1);
    expect(result.visibleRecalls.map(r => r.title)).toEqual(['Infant formula recall']);
  });
  it('isolates cached recall decisions by family', () => {
    expect(recallRadarQueryOptions('family-a').queryKey).toEqual(['recall-radar', 'family-a']);
    expect(recallRadarQueryOptions('family-b').queryKey).toEqual(['recall-radar', 'family-b']);
  });
});