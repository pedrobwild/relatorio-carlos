import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQueryFreshness } from '../useQueryFreshness';
import type { ReactNode } from 'react';

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useQueryFreshness', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    client.clear();
  });

  it('reports null updatedAt and Infinity age when the query has never resolved', () => {
    const { result } = renderHook(() => useQueryFreshness(['unknown']), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.updatedAt).toBeNull();
    expect(result.current.ageMinutes).toBe(Infinity);
  });

  it('reports an age once the query has resolved', async () => {
    const queryKey = ['some-data'];
    await client.prefetchQuery({
      queryKey,
      queryFn: async () => 'value',
    });

    const { result } = renderHook(() => useQueryFreshness(queryKey), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.updatedAt).toBeInstanceOf(Date);
    expect(result.current.ageMinutes).toBe(0);
    expect(result.current.isFetching).toBe(false);
  });

  it('age increases as time passes without a refetch', async () => {
    const queryKey = ['aging-data'];
    await client.prefetchQuery({
      queryKey,
      queryFn: async () => 'value',
    });

    const { result } = renderHook(() => useQueryFreshness(queryKey), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.ageMinutes).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(3 * 60_000);
    });

    expect(result.current.ageMinutes).toBeGreaterThanOrEqual(3);
  });
});
