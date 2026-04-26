import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Read/write a single string param from the URL query as React state.
 *
 * Why this exists:
 *   The Portfolio surface kept all filter state in `useState`, so a refresh
 *   or a shared link lost the user's filters (issue #16 calls out URL sync
 *   for filters as a Definition-of-Done item). `useSearchParams` gives us
 *   the primitive but is awkward to use per-key — this hook gives a typed
 *   `[value, setValue]` tuple that omits the param when it equals the
 *   default, so the URL stays clean.
 *
 * @param key            Query-string key (e.g. `'preset'`).
 * @param defaultValue   Value used when the param is absent or invalid.
 *                       Setting state to this value strips the param.
 * @param isValid        Optional guard to reject unknown values from the URL
 *                       (e.g. a user manually typing `?preset=foo`). Invalid
 *                       values fall back to `defaultValue`.
 *
 * Example:
 *   const [preset, setPreset] = useUrlParam<'all' | 'mine'>(
 *     'preset', 'all', (v): v is 'all' | 'mine' => v === 'all' || v === 'mine',
 *   );
 */
export function useUrlParam<T extends string>(
  key: string,
  defaultValue: T,
  isValid?: (v: string) => v is T,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(key);
  let value: T = defaultValue;
  if (raw !== null && raw !== '') {
    if (!isValid || isValid(raw)) value = raw as T;
  }

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        prev => {
          if (next === defaultValue) {
            prev.delete(key);
          } else {
            prev.set(key, next);
          }
          return prev;
        },
        { replace: true },
      );
    },
    [setSearchParams, key, defaultValue],
  );

  return [value, setValue];
}

/**
 * Variant of `useUrlParam` that allows the value to be `null` (i.e. "no
 * selection"). Useful for filters like `kpi` or `engineer` where there is
 * no natural default value, just "absent".
 */
export function useNullableUrlParam<T extends string>(
  key: string,
  isValid?: (v: string) => v is T,
): [T | null, (next: T | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(key);
  let value: T | null = null;
  if (raw !== null && raw !== '') {
    if (!isValid || isValid(raw)) value = raw as T;
  }

  const setValue = useCallback(
    (next: T | null) => {
      setSearchParams(
        prev => {
          if (next === null) {
            prev.delete(key);
          } else {
            prev.set(key, next);
          }
          return prev;
        },
        { replace: true },
      );
    },
    [setSearchParams, key],
  );

  return [value, setValue];
}
