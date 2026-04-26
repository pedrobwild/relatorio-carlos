/**
 * URL-backed state for the Portfolio's `AdvancedFilters` object.
 *
 * Keeps the same `[value, setValue]` shape as the previous `useState`
 * call-site so `usePortfolioFilters` doesn't need other changes.
 *
 * Why repeated keys instead of comma-joined values:
 *   `URLSearchParams` supports multiple values per key out of the box
 *   (`?status=active&status=paused`), and it doesn't break when a value
 *   itself contains a comma — common in customer names.
 *
 * URL schema (all params optional; absent = "no filter"):
 *   status=…       repeated. e.g. ?status=active&status=paused
 *   phase=…        repeated. 'project' | 'execution'
 *   engineers=…    repeated. engineer_user_id values
 *   customers=…    repeated. customer_name values
 *   cities=…       repeated. cidade values
 *   units=…        repeated. unit_name values
 *   health=…       repeated. 'excellent' | 'good' | 'attention' | 'critical'
 *   crit=…         repeated. 'overdue' | 'blocked' | 'stale'
 *   docs=1         present-when-true. (null = "no filter")
 *   sign=1         present-when-true.
 *   from=…         yyyy-MM-dd
 *   to=…           yyyy-MM-dd
 *   cmin=…         number (min contract value)
 *   cmax=…         number (max contract value)
 *
 * The single `?eng=` param that backs `selectedEngineer` (used by
 * `useNullableUrlParam` in `usePortfolioFilters`) is intentionally distinct
 * from the multi-select `engineers` param defined here.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type AdvancedFilters, emptyFilters } from './types';

const ARRAY_KEYS = [
  'status', 'phase', 'engineers', 'customers', 'cities', 'units', 'health', 'crit',
] as const;
const BOOL_KEYS = ['docs', 'sign'] as const;
const STRING_KEYS = ['from', 'to'] as const;
const NUMBER_KEYS = ['cmin', 'cmax'] as const;

const ALL_KEYS = [
  ...ARRAY_KEYS,
  ...BOOL_KEYS,
  ...STRING_KEYS,
  ...NUMBER_KEYS,
] as const;

export function parseAdvancedFiltersFromSearch(params: URLSearchParams): AdvancedFilters {
  const getAll = (k: string) => params.getAll(k).filter(Boolean);
  const getNum = (k: string): number | null => {
    const raw = params.get(k);
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const getBool = (k: string): boolean | null => (params.get(k) === '1' ? true : null);

  return {
    status: getAll('status'),
    phase: getAll('phase'),
    engineers: getAll('engineers'),
    customers: getAll('customers'),
    cities: getAll('cities'),
    units: getAll('units'),
    health: getAll('health'),
    criticality: getAll('crit'),
    hasPendingDocs: getBool('docs'),
    hasPendingSign: getBool('sign'),
    dateRange: {
      from: params.get('from') || null,
      to: params.get('to') || null,
    },
    contractMin: getNum('cmin'),
    contractMax: getNum('cmax'),
  };
}

/**
 * Returns the same URLSearchParams instance with the advanced-filter keys
 * stripped, then re-applies the encoding from `next`. Mutating in place is
 * intentional — `setSearchParams(prev => …)` expects a mutated `prev`.
 */
function applyAdvancedFiltersToSearch(
  params: URLSearchParams,
  next: AdvancedFilters,
): URLSearchParams {
  for (const key of ALL_KEYS) params.delete(key);

  const setMany = (key: string, values: string[]) => {
    for (const v of values) if (v) params.append(key, v);
  };

  setMany('status', next.status);
  setMany('phase', next.phase);
  setMany('engineers', next.engineers);
  setMany('customers', next.customers);
  setMany('cities', next.cities);
  setMany('units', next.units);
  setMany('health', next.health);
  setMany('crit', next.criticality);

  if (next.hasPendingDocs === true) params.set('docs', '1');
  if (next.hasPendingSign === true) params.set('sign', '1');

  if (next.dateRange.from) params.set('from', next.dateRange.from);
  if (next.dateRange.to) params.set('to', next.dateRange.to);

  if (next.contractMin !== null) params.set('cmin', String(next.contractMin));
  if (next.contractMax !== null) params.set('cmax', String(next.contractMax));

  return params;
}

export function useAdvancedFiltersUrl(): [AdvancedFilters, (next: AdvancedFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => parseAdvancedFiltersFromSearch(searchParams),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: AdvancedFilters) => {
      setSearchParams(prev => applyAdvancedFiltersToSearch(prev, next), { replace: true });
    },
    [setSearchParams],
  );

  return [filters, setFilters];
}

/** Re-export for convenience and to surface the canonical empty value. */
export { emptyFilters };
