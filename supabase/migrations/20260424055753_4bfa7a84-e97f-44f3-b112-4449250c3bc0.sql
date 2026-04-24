-- ============ TABELAS ============

CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conversations_user ON public.assistant_conversations(user_id, last_message_at DESC);

CREATE TABLE public.assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  result_data JSONB,
  log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_messages_conv ON public.assistant_messages(conversation_id, created_at);

CREATE TABLE public.assistant_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  generated_sql TEXT,
  domain TEXT,
  rows_returned INTEGER,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','sql_blocked','sql_error','llm_error','timeout','other')),
  error_message TEXT,
  answer_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_logs_user ON public.assistant_logs(user_id, created_at DESC);
CREATE INDEX idx_assistant_logs_status ON public.assistant_logs(status, created_at DESC);
CREATE INDEX idx_assistant_logs_created ON public.assistant_logs(created_at DESC);

CREATE TRIGGER trg_assistant_conv_updated
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.assistant_conversations FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users create own conversations"
  ON public.assistant_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.assistant_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON public.assistant_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own messages"
  ON public.assistant_messages FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users insert own messages"
  ON public.assistant_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own logs"
  ON public.assistant_logs FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users insert own logs"
  ON public.assistant_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============ RPC SEGURA ============

CREATE OR REPLACE FUNCTION public.execute_assistant_query(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_sql_lower TEXT;
  v_normalized TEXT;
  v_result JSONB;
BEGIN
  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN
    RAISE EXCEPTION 'SQL vazio';
  END IF;

  v_normalized := trim(p_sql);
  v_normalized := regexp_replace(v_normalized, ';+\s*$', '');

  IF position(';' IN v_normalized) > 0 THEN
    RAISE EXCEPTION 'Multiplas instrucoes nao sao permitidas';
  END IF;

  v_sql_lower := lower(v_normalized);

  IF NOT (v_sql_lower ~ '^\s*(select|with)\s') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT sao permitidas';
  END IF;

  IF v_sql_lower ~ '\m(insert|update|delete|drop|alter|truncate|grant|revoke|create|comment|vacuum|analyze|reindex|cluster|lock|execute|copy|call)\M' THEN
    RAISE EXCEPTION 'Comando proibido detectado na consulta';
  END IF;

  IF v_sql_lower ~ '\m(pg_sleep|pg_read_server_files|pg_ls_dir|pg_write_server_files|lo_import|lo_export|pg_terminate|pg_cancel)\M' THEN
    RAISE EXCEPTION 'Funcao proibida detectada';
  END IF;

  IF position('$$' IN v_sql_lower) > 0 OR v_sql_lower ~ '\mdo\s+\$' THEN
    RAISE EXCEPTION 'Blocos anonimos nao sao permitidos';
  END IF;

  IF v_sql_lower ~ '\m(auth|storage|vault|supabase_functions)\.' THEN
    RAISE EXCEPTION 'Acesso a esquemas internos nao e permitido';
  END IF;

  PERFORM set_config('statement_timeout', '5000', true);

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s LIMIT 200) t',
    v_normalized
  ) INTO v_result;

  RETURN v_result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.execute_assistant_query(TEXT) TO authenticated;