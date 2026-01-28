/**
 * Base Repository
 * 
 * Provides common patterns for data access with error handling,
 * pagination, and type safety.
 */

import { supabase } from '@/infra/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

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
}

export interface RepositoryListResult<T> {
  data: T[];
  error: PostgrestError | null;
}

/**
 * Wraps a Supabase query with consistent error handling
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<RepositoryResult<T>> {
  try {
    const { data, error } = await queryFn();
    return { data, error };
  } catch (err) {
    console.error('Repository query error:', err);
    return { 
      data: null, 
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        details: '',
        hint: '',
        code: 'UNKNOWN',
      } as PostgrestError
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
    return { data: data ?? [], error };
  } catch (err) {
    console.error('Repository list query error:', err);
    return { 
      data: [], 
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        details: '',
        hint: '',
        code: 'UNKNOWN',
      } as PostgrestError
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
