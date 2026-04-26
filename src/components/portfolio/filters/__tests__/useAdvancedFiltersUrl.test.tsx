import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import {
  parseAdvancedFiltersFromSearch,
  useAdvancedFiltersUrl,
} from '../useAdvancedFiltersUrl';
import { emptyFilters, type AdvancedFilters } from '../types';

function withRouter(initialEntry: string, capture?: { search: string }) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <CaptureSearch capture={capture}>{children}</CaptureSearch>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function CaptureSearch({
  capture,
  children,
}: { capture?: { search: string }; children: ReactNode }) {
  const loc = useLocation();
  if (capture) capture.search = loc.search;
  return <>{children}</>;
}

describe('parseAdvancedFiltersFromSearch', () => {
  it('returns emptyFilters when the URL has no advanced params', () => {
    const params = new URLSearchParams('');
    expect(parseAdvancedFiltersFromSearch(params)).toEqual(emptyFilters);
  });

  it('reads repeated array params (status, phase, crit)', () => {
    const params = new URLSearchParams(
      'status=active&status=paused&phase=execution&crit=overdue&crit=stale',
    );
    const result = parseAdvancedFiltersFromSearch(params);
    expect(result.status).toEqual(['active', 'paused']);
    expect(result.phase).toEqual(['execution']);
    expect(result.criticality).toEqual(['overdue', 'stale']);
  });

  it('reads boolean flags (docs, sign) only when set to "1"', () => {
    expect(parseAdvancedFiltersFromSearch(new URLSearchParams('docs=1')).hasPendingDocs).toBe(true);
    expect(parseAdvancedFiltersFromSearch(new URLSearchParams('sign=1')).hasPendingSign).toBe(true);
    // Any other value (including "0", "true") is treated as "no filter".
    expect(parseAdvancedFiltersFromSearch(new URLSearchParams('docs=0')).hasPendingDocs).toBeNull();
    expect(parseAdvancedFiltersFromSearch(new URLSearchParams('docs=true')).hasPendingDocs).toBeNull();
  });

  it('reads date range and numeric contract bounds', () => {
    const params = new URLSearchParams('from=2025-01-01&to=2025-12-31&cmin=100000&cmax=500000');
    const result = parseAdvancedFiltersFromSearch(params);
    expect(result.dateRange).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(result.contractMin).toBe(100000);
    expect(result.contractMax).toBe(500000);
  });

  it('treats non-numeric cmin/cmax as null (no filter) instead of NaN', () => {
    const params = new URLSearchParams('cmin=foo&cmax=bar');
    const result = parseAdvancedFiltersFromSearch(params);
    expect(result.contractMin).toBeNull();
    expect(result.contractMax).toBeNull();
  });
});

describe('useAdvancedFiltersUrl', () => {
  it('reads the initial filters from the URL', () => {
    const { result } = renderHook(() => useAdvancedFiltersUrl(), {
      wrapper: withRouter('/?status=paused&docs=1&from=2025-01-01'),
    });
    const [filters] = result.current;
    expect(filters.status).toEqual(['paused']);
    expect(filters.hasPendingDocs).toBe(true);
    expect(filters.dateRange.from).toBe('2025-01-01');
  });

  it('round-trips a complex filter set through the URL', () => {
    const probe = { search: '' };
    const { result } = renderHook(() => useAdvancedFiltersUrl(), {
      wrapper: withRouter('/', probe),
    });

    const next: AdvancedFilters = {
      status: ['active', 'paused'],
      phase: ['execution'],
      engineers: ['eng-1', 'eng-2'],
      customers: ['Acme, Inc.'], // value with comma — must survive
      cities: ['São Paulo'],
      units: [],
      health: ['attention'],
      hasPendingDocs: true,
      hasPendingSign: null,
      criticality: ['overdue'],
      dateRange: { from: '2025-01-01', to: null },
      contractMin: 100000,
      contractMax: null,
    };

    act(() => result.current[1](next));

    const search = probe.search;
    expect(search).toContain('status=active');
    expect(search).toContain('status=paused');
    expect(search).toContain('phase=execution');
    expect(search).toContain('engineers=eng-1');
    expect(search).toContain('engineers=eng-2');
    // Comma + space in customer name survive the round-trip via URLSearchParams
    // (which decodes "+" back to " ").
    const parsed = new URLSearchParams(search);
    expect(parsed.getAll('customers')).toEqual(['Acme, Inc.']);
    expect(parsed.getAll('cities')).toEqual(['São Paulo']);
    expect(search).toContain('docs=1');
    expect(search).not.toContain('sign=');
    expect(search).toContain('from=2025-01-01');
    expect(search).not.toContain('to=');
    expect(search).toContain('cmin=100000');
    expect(search).not.toContain('cmax=');

    // The hook now reads the same values back.
    const [readBack] = result.current;
    expect(readBack).toEqual(next);
  });

  it('clears all advanced params when set back to emptyFilters', () => {
    const probe = { search: '' };
    const { result } = renderHook(() => useAdvancedFiltersUrl(), {
      wrapper: withRouter('/?status=active&docs=1&from=2025-01-01', probe),
    });

    act(() => result.current[1](emptyFilters));
    expect(probe.search).toBe('');
  });

  it('does not touch unrelated query params on update', () => {
    const probe = { search: '' };
    const { result } = renderHook(() => useAdvancedFiltersUrl(), {
      wrapper: withRouter('/?q=loja&preset=mine&status=active', probe),
    });

    act(() =>
      result.current[1]({
        ...emptyFilters,
        status: ['paused'],
      }),
    );

    expect(probe.search).toContain('q=loja');
    expect(probe.search).toContain('preset=mine');
    expect(probe.search).toContain('status=paused');
    expect(probe.search).not.toContain('status=active');
  });
});
