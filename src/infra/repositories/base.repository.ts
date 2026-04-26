/**
 * Base Repository
 *
 * Provides common patterns for data access with error handling,
 * pagination, and type safety.
 */

import { supabase } from '@/infra/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import { mapError, type UserError } from '@/lib/errorMapping';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RepositoryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  /**
   * Erro humanizado pronto para exibir ao usuário (`mapError`).
   * Opcional por compatibilidade — `executeQuery` sempre popula quando há `error`.
   * Para erros construídos manualmente, considere passar pelo `mapError`.
   */
  userError?: UserError | null;
}

export interface RepositoryListResult<T> {
  data: T[];
  error: PostgrestError | null;
  userError?: UserError | null;
}

function buildUnknownPgError(err: unknown): PostgrestError {
  return {
    message: err instanceof Error ? err.message : 'Unknown error',
    details: '',
    hint: '',
    code: 'UNKNOWN',
  } as PostgrestError;
}

/**
 * Wraps a Supabase query with consistent error handling.
 * Anexa `userError` (humanizado) sempre que houver falha, para que a UI
 * NUNCA precise mostrar `error.message` cru ao usuário.
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<RepositoryResult<T>> {
  try {
    const { data, error } = await queryFn();
    return {
      data,
      error,
      userError: error ? mapError(error) : null,
    };
  } catch (err) {
    console.error('Repository query error:', err);
    const pgError = buildUnknownPgError(err);
    return {
      data: null,
      error: pgError,
      userError: mapError(err),
    };
  }
}

/**
 * Wraps a Supabase list query with pagination
 */
export async function executeListQuery<T>(
  queryFn: () => Promise<{ data: T[] | null; error: PostgrestError | null; count?: number | null }>
): Promise<RepositoryListResult<T>> {
  try {
    const { data, error } = await queryFn();
    return {
      data: data ?? [],
      error,
      userError: error ? mapError(error) : null,
    };
  } catch (err) {
    console.error('Repository list query error:', err);
    const pgError = buildUnknownPgError(err);
    return {
      data: [],
      error: pgError,
      userError: mapError(err),
    };
  }
}

/**
 * Calculate pagination range for Supabase queries
 */
export function getPaginationRange(params: PaginationParams): { from: number; to: number } {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

// Export supabase for direct access in repositories
export { supabase };
