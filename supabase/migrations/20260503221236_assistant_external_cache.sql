-- ============================================================
-- Assistente BWild v4 — cache de dados externos (mercado, regulação, fornecedor)
-- Espelho do DERIVATIONS para "fora": antes de gastar chamada de API/Perplexity,
-- consultamos esta tabela. TTL por fonte (ver EXTERNAL_SOURCES.cache_ttl_hours).
-- ============================================================

CREATE TABLE public.assistant_external_cache (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id   TEXT NOT NULL,
  query_hash  TEXT NOT NULL,
  query_raw   JSONB NOT NULL,
  result      JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  cost_cents  INTEGER,
  CONSTRAINT uq_external_cache_lookup UNIQUE (source_id, query_hash)
);

CREATE INDEX idx_external_cache_lookup
  ON public.assistant_external_cache(source_id, query_hash, expires_at);

CREATE INDEX idx_external_cache_expires
  ON public.assistant_external_cache(expires_at);

-- O cache é consultado e gravado pela Edge Function (com service_role).
-- Permitimos staff a ler para auditoria; ninguém escreve via PostgREST.
ALTER TABLE public.assistant_external_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view external cache"
  ON public.assistant_external_cache FOR SELECT
  USING (public.is_staff(auth.uid()));

-- ============================================================
-- Telemetria adicional em assistant_logs para o pipeline v4
-- ============================================================

ALTER TABLE public.assistant_logs
  ADD COLUMN IF NOT EXISTS external_calls_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_cache_hits  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_cost_cents  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_sources_used JSONB;
