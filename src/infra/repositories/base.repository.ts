/**
 * Base Repository
 *
 * Provides common patterns for data access with error handling,
 * pagination, and type safety.
 */

import { supabase } from "@/infra/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import { mapError, type UserError } from "@/lib/errorMapping";

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

/**
 * PostgrestError augmentado com `userError` — uma versão humanizada do erro
 * pronta para mostrar ao usuário (kind/userMessage/suggestedAction).
 *
 * Compatível com PostgrestError; código existente que lê `error.message` segue
 * funcionando. Novo código deve preferir `error.userError.userMessage`.
 */
export type RepositoryError = PostgrestError & { userError: UserError };

export interface RepositoryResult<T> {
  data: T | null;
  error: RepositoryError | null;
}

export interface RepositoryListResult<T> {
  data: T[];
  error: RepositoryError | null;
}

/**
 * Anexa `userError` (resultado de `mapError`) a um erro Supabase.
 * Não modifica o erro original; retorna um clone com a propriedade extra.
 */
function attachUserError(error: PostgrestError | null): RepositoryError | null {
  if (!error) return null;
  // Já mapeado? Mantém para evitar trabalho duplo.
  if ((error as RepositoryError).userError) return error as RepositoryError;
  return Object.assign({}, error, {
    userError: mapError(error),
  }) as RepositoryError;
}

function buildSyntheticError(err: unknown): RepositoryError {
  const userError = mapError(err);
  const synthetic: PostgrestError = {
    message: err instanceof Error ? err.message : "Unknown error",
    details: "",
    hint: "",
    code: "UNKNOWN",
  } as PostgrestError;
  return Object.assign(synthetic, { userError });
}

/**
 * Wraps a Supabase query with consistent error handling.
 *
 * O erro retornado é um `RepositoryError` — `PostgrestError` augmentado com
 * `userError: UserError`. Callers podem ler `result.error.userError.userMessage`
 * para mostrar mensagem humanizada sem precisar chamar `mapError` manualmente.
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
): Promise<RepositoryResult<T>> {
  try {
    const { data, error } = await queryFn();
    return { data, error: attachUserError(error) };
  } catch (err) {
    console.error("Repository query error:", err);
    return { data: null, error: buildSyntheticError(err) };
  }
}

/**
 * Wraps a Supabase list query with pagination
 */
export async function executeListQuery<T>(
  queryFn: () => Promise<{
    data: T[] | null;
    error: PostgrestError | null;
    count?: number | null;
  }>,
): Promise<RepositoryListResult<T>> {
  try {
    const { data, error } = await queryFn();
    return { data: data ?? [], error: attachUserError(error) };
  } catch (err) {
    console.error("Repository list query error:", err);
    return { data: [], error: buildSyntheticError(err) };
  }
}

/**
 * Atalho para extrair a mensagem humana de um erro de repositório.
 */
export function getUserMessageFromRepoError(
  error: RepositoryError | PostgrestError | null,
): string {
  if (!error) return "";
  const ue = (error as RepositoryError).userError ?? mapError(error);
  return ue.userMessage;
}

/**
 * Calculate pagination range for Supabase queries
 */
export function getPaginationRange(params: PaginationParams): {
  from: number;
  to: number;
} {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

// Export supabase for direct access in repositories
export { supabase };
