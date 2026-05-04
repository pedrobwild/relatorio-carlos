import { useEffect, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

export interface QueryFreshness {
  /** When the query last successfully resolved. `null` if it never did. */
  updatedAt: Date | null;
  /** Age in minutes since last successful fetch. `Infinity` if never resolved. */
  ageMinutes: number;
  /** Whether TanStack Query considers the data stale. */
  isStale: boolean;
  /** Whether a refetch is currently in flight. */
  isFetching: boolean;
}

const TICK_MS = 30_000;

/**
 * Reports how fresh a TanStack Query is so the UI can show the user
 * when data was last updated and offer a manual refresh.
 *
 * Re-renders every 30s so the displayed age stays current.
 */
export function useQueryFreshness(queryKey: QueryKey): QueryFreshness {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe(event => {
      const eventKey = event.query.queryKey;
      if (JSON.stringify(eventKey) === JSON.stringify(queryKey)) {
        setTick(t => t + 1);
      }
    });

    const interval = setInterval(() => setTick(t => t + 1), TICK_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queryClient, queryKey]);

  // tick is read to force re-render; eslint-disable line is intentional.
  void tick;

  const state = queryClient.getQueryState(queryKey);
  const dataUpdatedAt = state?.dataUpdatedAt ?? 0;
  const updatedAt = dataUpdatedAt > 0 ? new Date(dataUpdatedAt) : null;
  const ageMinutes = updatedAt
    ? Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 60_000))
    : Infinity;

  const query = queryClient.getQueryCache().find({ queryKey });
  const isStale = query?.isStale() ?? true;
  const isFetching = (state?.fetchStatus ?? 'idle') === 'fetching';

  return { updatedAt, ageMinutes, isStale, isFetching };
}
