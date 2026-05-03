// Helpers para o cache de dados externos do Assistente BWild (v4).
//
// Política:
//   - query_hash = sha256(source_id || JSON.stringify(query_params normalizado)).
//   - SEMPRE consultar cache antes de chamar fonte externa.
//     Hit válido: row.expires_at > now().
//   - Após chamar a fonte, gravar com expires_at = now() + cache_ttl_hours.
//   - O job de limpeza apaga expires_at < now() - 7 dias (fora deste arquivo).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface CacheLookupResult<T = unknown> {
  hit: boolean;
  value?: T;
  fetched_at?: string;
  expires_at?: string;
}

export interface CachedResult<T = unknown> {
  source_id: string;
  query_hash: string;
  query_raw: Record<string, unknown>;
  result: T;
  cost_cents?: number;
}

/**
 * Hash determinístico de (source_id, params). SHA-256 hex via SubtleCrypto.
 * Normaliza chaves do params antes de serializar para evitar miss por ordem.
 */
export async function hashQuery(
  sourceId: string,
  params: Record<string, unknown>,
): Promise<string> {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(params).sort()) sorted[k] = params[k];
  const payload = `${sourceId}|${JSON.stringify(sorted)}`;
  const buf = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cliente service-role. Cache não respeita RLS (é cache global). */
function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "externalCache requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key);
}

export async function lookupCache<T = unknown>(
  sourceId: string,
  queryHash: string,
): Promise<CacheLookupResult<T>> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("assistant_external_cache")
    .select("result, fetched_at, expires_at")
    .eq("source_id", sourceId)
    .eq("query_hash", queryHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return { hit: false };
  return {
    hit: true,
    value: data.result as T,
    fetched_at: data.fetched_at as string,
    expires_at: data.expires_at as string,
  };
}

export async function storeCache(opts: {
  sourceId: string;
  queryHash: string;
  queryRaw: Record<string, unknown>;
  result: unknown;
  ttlHours: number;
  costCents?: number;
}): Promise<void> {
  const sb = adminClient();
  const expires = new Date(Date.now() + opts.ttlHours * 3600 * 1000);
  const { error } = await sb
    .from("assistant_external_cache")
    .upsert(
      {
        source_id: opts.sourceId,
        query_hash: opts.queryHash,
        query_raw: opts.queryRaw,
        result: opts.result,
        fetched_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        cost_cents: opts.costCents ?? null,
      },
      { onConflict: "source_id,query_hash" },
    );
  if (error) {
    console.warn("[externalCache] upsert failed:", error.message);
  }
}
