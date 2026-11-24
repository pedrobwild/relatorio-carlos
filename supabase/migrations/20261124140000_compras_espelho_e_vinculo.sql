-- Fase 2 (2.1 + 2.2) — Bwild Compras como fonte única, lida pelo Workflow.
--
-- O Workflow puxa os dados do Bwild Compras (função sync-compras-pull) e guarda
-- uma cópia SOMENTE LEITURA aqui. Nada é escrito no banco do Compras.
--
--   compras_obra_vinculos     -> de qual obra do Workflow é cada obra do Compras.
--                                Confirmado por uma pessoa, um por um. Nunca
--                                por semelhança de texto.
--   compras_solicitacoes      -> cópia do painel de solicitações (sem custo).
--   compras_solicitacao_itens -> cópia dos itens.
--   compras_pedidos           -> cópia das compras registradas (fornecedor e valor).
--   compras_sync_execucoes    -> registro de cada rodada.
--   compras_sync_config       -> token do agendamento (ninguém lê pelo app).
--
-- Regras de acesso: só equipe interna lê. Cliente e visitante não leem nada.
-- Ninguém grava direto: só as funções abaixo.
-- Nada é apagado: o que some do Compras fica marcado em removido_em.

-- ───────────────────────── vínculo de obra ─────────────────────────
CREATE TABLE IF NOT EXISTS public.compras_obra_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  cliente text NOT NULL,
  empreendimento text,
  unidade text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'ignorado')),
  decidido_por uuid,
  decidido_por_nome text,
  decidido_em timestamptz,
  primeira_vez_em timestamptz NOT NULL DEFAULT now(),
  ultima_vez_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compras_obra_vinculos_confirmado_tem_obra
    CHECK (status <> 'confirmado' OR project_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_compras_obra_vinculos_project
  ON public.compras_obra_vinculos (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_obra_vinculos_status
  ON public.compras_obra_vinculos (status);

-- Histórico das decisões (quem vinculou, desfez ou ignorou).
CREATE TABLE IF NOT EXISTS public.compras_obra_vinculo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_id uuid NOT NULL REFERENCES public.compras_obra_vinculos(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('confirmado', 'desfeito', 'ignorado')),
  project_id uuid,
  feito_por uuid,
  feito_por_nome text,
  feito_em timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── cópias somente leitura ─────────────────────────
CREATE TABLE IF NOT EXISTS public.compras_solicitacoes (
  id uuid PRIMARY KEY,                       -- mesmo id do Bwild Compras
  vinculo_id uuid NOT NULL REFERENCES public.compras_obra_vinculos(id),
  codigo text,
  numero bigint,
  cliente text,
  empreendimento text,
  unidade text,
  titulo text,
  prioridade text,
  status text NOT NULL,
  data_necessaria date,
  prazo_compra date,
  proxima_entrega date,
  locais_entrega text,
  qtd_itens integer,
  solicitante_nome text,
  responsavel_nome text,
  dias_atraso integer,
  dias_atraso_compra integer,
  dias_atraso_entrega integer,
  dias_atraso_chegada integer,
  tipo_atraso text,
  situacao_prazo text,
  vence_em_dias integer,
  criado_no_compras_em timestamptz,
  atualizado_no_compras_em timestamptz,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_compras_solicitacoes_vinculo
  ON public.compras_solicitacoes (vinculo_id) WHERE removido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_compras_solicitacoes_data
  ON public.compras_solicitacoes (data_necessaria) WHERE removido_em IS NULL;

CREATE TABLE IF NOT EXISTS public.compras_solicitacao_itens (
  id uuid PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.compras_solicitacoes(id),
  descricao text,
  quantidade numeric(12,2),
  unidade text,
  ambiente text,
  categoria text,
  especificacao text,
  referencia_projeto text,
  observacao text,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_compras_solicitacao_itens_sol
  ON public.compras_solicitacao_itens (solicitacao_id) WHERE removido_em IS NULL;

-- Custo e fornecedor ficam SÓ nesta tabela, separados da lista, para a regra
-- de quem vê custo poder ser apertada sem mexer no resto.
CREATE TABLE IF NOT EXISTS public.compras_pedidos (
  id uuid PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.compras_solicitacoes(id),
  fornecedor text,
  descricao_itens text,
  valor_total numeric(12,2),
  forma_pagamento text,
  numero_pedido text,
  data_compra date,
  previsao_entrega date,
  local_entrega text,
  data_entrega_real date,
  recebido_por text,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_compras_pedidos_sol
  ON public.compras_pedidos (solicitacao_id) WHERE removido_em IS NULL;

CREATE TABLE IF NOT EXISTS public.compras_sync_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL DEFAULT 'agendado',   -- agendado | manual | recarga
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  terminado_em timestamptz,
  ok boolean,
  solicitacoes integer,
  itens integer,
  pedidos integer,
  obras_novas integer,
  removidos integer,
  erro text
);
CREATE INDEX IF NOT EXISTS idx_compras_sync_execucoes_inicio
  ON public.compras_sync_execucoes (iniciado_em DESC);

CREATE TABLE IF NOT EXISTS public.compras_sync_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cron_token text NOT NULL
);
INSERT INTO public.compras_sync_config (id, cron_token)
VALUES (true, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────── regras de acesso ─────────────────────────
ALTER TABLE public.compras_obra_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_obra_vinculo_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_sync_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_sync_config ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'compras_obra_vinculos', 'compras_obra_vinculo_historico', 'compras_solicitacoes',
    'compras_solicitacao_itens', 'compras_pedidos', 'compras_sync_execucoes'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "equipe interna le" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "equipe interna le" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
  END LOOP;
END $$;

-- O token do agendamento não é lido por ninguém pelo app (sem grant, sem policy).
REVOKE ALL ON public.compras_sync_config FROM anon, authenticated;

-- ───────────────────────── funções ─────────────────────────
CREATE OR REPLACE FUNCTION public.compras_chave_obra(p_cliente text, p_empreendimento text, p_unidade text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(btrim(regexp_replace(coalesce(p_cliente, ''), '\s+', ' ', 'g'))) || '|' ||
         lower(btrim(regexp_replace(coalesce(p_empreendimento, ''), '\s+', ' ', 'g'))) || '|' ||
         lower(btrim(regexp_replace(coalesce(p_unidade, ''), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.compras_pode_conciliar(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(p_user, 'admin') OR public.has_role(p_user, 'manager')
      OR public.has_role(p_user, 'gestor') OR public.has_role(p_user, 'suprimentos')
$$;

CREATE OR REPLACE FUNCTION public.compras_nome_de(p_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  BEGIN
    SELECT nullif(btrim(nome), '') INTO v FROM public.users_profile WHERE id = p_user;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v := NULL;
  END;
  RETURN coalesce(v, 'Equipe Bwild');
END $$;

-- Confirmar, desfazer ou ignorar o vínculo de UMA obra do Compras.
--   p_acao = 'confirmar' (exige p_project_id) | 'desfazer' | 'ignorar'
CREATE OR REPLACE FUNCTION public.compras_decidir_vinculo(
  p_vinculo_id uuid, p_acao text, p_project_id uuid DEFAULT NULL
) RETURNS public.compras_obra_vinculos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.compras_obra_vinculos;
  v_nome text;
BEGIN
  IF v_user IS NULL OR NOT public.compras_pode_conciliar(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para vincular obras do Compras.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.compras_obra_vinculos WHERE id = p_vinculo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra do Compras não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  v_nome := public.compras_nome_de(v_user);

  IF p_acao = 'confirmar' THEN
    IF p_project_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
      RAISE EXCEPTION 'Escolha a obra do Workflow.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.compras_obra_vinculos
       SET project_id = p_project_id, status = 'confirmado',
           decidido_por = v_user, decidido_por_nome = v_nome, decidido_em = now()
     WHERE id = p_vinculo_id RETURNING * INTO v_row;
    INSERT INTO public.compras_obra_vinculo_historico (vinculo_id, acao, project_id, feito_por, feito_por_nome)
    VALUES (p_vinculo_id, 'confirmado', p_project_id, v_user, v_nome);
  ELSIF p_acao = 'desfazer' THEN
    INSERT INTO public.compras_obra_vinculo_historico (vinculo_id, acao, project_id, feito_por, feito_por_nome)
    VALUES (p_vinculo_id, 'desfeito', v_row.project_id, v_user, v_nome);
    UPDATE public.compras_obra_vinculos
       SET project_id = NULL, status = 'pendente',
           decidido_por = v_user, decidido_por_nome = v_nome, decidido_em = now()
     WHERE id = p_vinculo_id RETURNING * INTO v_row;
  ELSIF p_acao = 'ignorar' THEN
    UPDATE public.compras_obra_vinculos
       SET project_id = NULL, status = 'ignorado',
           decidido_por = v_user, decidido_por_nome = v_nome, decidido_em = now()
     WHERE id = p_vinculo_id RETURNING * INTO v_row;
    INSERT INTO public.compras_obra_vinculo_historico (vinculo_id, acao, feito_por, feito_por_nome)
    VALUES (p_vinculo_id, 'ignorado', v_user, v_nome);
  ELSE
    RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END $$;

-- Confere o token do agendamento (chamado pela função de borda, com a chave de serviço).
CREATE OR REPLACE FUNCTION public.compras_sync_token_ok(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.compras_sync_config
                 WHERE cron_token = p_token AND length(coalesce(p_token, '')) >= 32)
$$;

-- Abre uma rodada. Recusa se outra começou há menos de 60 s (evita rodadas em cima da outra).
CREATE OR REPLACE FUNCTION public.compras_sync_iniciar(p_origem text DEFAULT 'agendado')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('compras_sync'));
  IF EXISTS (SELECT 1 FROM public.compras_sync_execucoes
             WHERE iniciado_em > now() - interval '60 seconds') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.compras_sync_execucoes (origem)
  VALUES (CASE WHEN p_origem IN ('agendado', 'manual', 'recarga') THEN p_origem ELSE 'agendado' END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.compras_sync_falhar(p_execucao uuid, p_erro text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.compras_sync_execucoes
     SET terminado_em = now(), ok = false, erro = left(coalesce(p_erro, 'erro'), 1000)
   WHERE id = p_execucao
$$;

-- Aplica a foto completa do Compras. Pode rodar quantas vezes for preciso:
-- o resultado é sempre o mesmo para a mesma foto. O que não veio na foto é
-- marcado como removido (nunca apagado); se voltar a vir, é reaberto.
-- Obra nova entra como 'pendente', SEM obra do Workflow.
CREATE OR REPLACE FUNCTION public.compras_sync_aplicar(
  p_execucao uuid, p_solicitacoes jsonb, p_itens jsonb, p_pedidos jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obras_novas int := 0; v_sol int := 0; v_itens int := 0; v_ped int := 0;
  v_rem int := 0; v_n int;
BEGIN
  IF jsonb_typeof(coalesce(p_solicitacoes, 'null')) <> 'array'
     OR jsonb_typeof(coalesce(p_itens, 'null')) <> 'array'
     OR jsonb_typeof(coalesce(p_pedidos, 'null')) <> 'array' THEN
    RAISE EXCEPTION 'Foto do Compras incompleta.' USING ERRCODE = '22023';
  END IF;

  -- Foto vazia com cópia cheia quase sempre é falha de leitura, não o Compras
  -- zerado: recusa em vez de marcar tudo como removido.
  IF jsonb_array_length(p_solicitacoes) = 0
     AND EXISTS (SELECT 1 FROM public.compras_solicitacoes WHERE removido_em IS NULL) THEN
    RAISE EXCEPTION 'O Compras veio vazio. Nada foi alterado.' USING ERRCODE = '22023';
  END IF;

  -- 1) obras do Compras (uma por cliente + empreendimento + unidade, texto exato)
  WITH obras AS (
    SELECT DISTINCT ON (chave) chave, cliente, empreendimento, unidade FROM (
      SELECT public.compras_chave_obra(s->>'cliente', s->>'empreendimento', s->>'unidade') AS chave,
             coalesce(nullif(btrim(s->>'cliente'), ''), '(sem cliente)') AS cliente,
             nullif(btrim(s->>'empreendimento'), '') AS empreendimento,
             nullif(btrim(s->>'unidade'), '') AS unidade
      FROM jsonb_array_elements(p_solicitacoes) s
    ) x ORDER BY chave
  ), ins AS (
    INSERT INTO public.compras_obra_vinculos (chave, cliente, empreendimento, unidade)
    SELECT chave, cliente, empreendimento, unidade FROM obras
    ON CONFLICT (chave) DO UPDATE SET ultima_vez_em = now()
    RETURNING (xmax = 0) AS nova
  )
  SELECT count(*) FILTER (WHERE nova) INTO v_obras_novas FROM ins;

  -- 2) solicitações
  INSERT INTO public.compras_solicitacoes AS t (
    id, vinculo_id, codigo, numero, cliente, empreendimento, unidade, titulo, prioridade, status,
    data_necessaria, prazo_compra, proxima_entrega, locais_entrega, qtd_itens,
    solicitante_nome, responsavel_nome, dias_atraso, dias_atraso_compra, dias_atraso_entrega,
    dias_atraso_chegada, tipo_atraso, situacao_prazo, vence_em_dias,
    criado_no_compras_em, atualizado_no_compras_em, sincronizado_em, removido_em)
  SELECT (s->>'id')::uuid, v.id, s->>'codigo', (s->>'numero')::bigint, s->>'cliente',
         s->>'empreendimento', s->>'unidade', s->>'titulo', s->>'prioridade', s->>'status',
         (s->>'data_necessaria')::date, (s->>'prazo_compra')::date, (s->>'proxima_entrega')::date,
         s->>'locais_entrega', (s->>'qtd_itens')::int, s->>'solicitante_nome', s->>'responsavel_nome',
         (s->>'dias_atraso')::int, (s->>'dias_atraso_compra')::int, (s->>'dias_atraso_entrega')::int,
         (s->>'dias_atraso_chegada')::int, s->>'tipo_atraso', s->>'situacao_prazo',
         (s->>'vence_em_dias')::int, (s->>'created_at')::timestamptz, (s->>'updated_at')::timestamptz,
         now(), NULL
  FROM jsonb_array_elements(p_solicitacoes) s
  JOIN public.compras_obra_vinculos v
    ON v.chave = public.compras_chave_obra(s->>'cliente', s->>'empreendimento', s->>'unidade')
  ON CONFLICT (id) DO UPDATE SET
    vinculo_id = EXCLUDED.vinculo_id, codigo = EXCLUDED.codigo, numero = EXCLUDED.numero,
    cliente = EXCLUDED.cliente, empreendimento = EXCLUDED.empreendimento, unidade = EXCLUDED.unidade,
    titulo = EXCLUDED.titulo, prioridade = EXCLUDED.prioridade, status = EXCLUDED.status,
    data_necessaria = EXCLUDED.data_necessaria, prazo_compra = EXCLUDED.prazo_compra,
    proxima_entrega = EXCLUDED.proxima_entrega, locais_entrega = EXCLUDED.locais_entrega,
    qtd_itens = EXCLUDED.qtd_itens, solicitante_nome = EXCLUDED.solicitante_nome,
    responsavel_nome = EXCLUDED.responsavel_nome, dias_atraso = EXCLUDED.dias_atraso,
    dias_atraso_compra = EXCLUDED.dias_atraso_compra, dias_atraso_entrega = EXCLUDED.dias_atraso_entrega,
    dias_atraso_chegada = EXCLUDED.dias_atraso_chegada, tipo_atraso = EXCLUDED.tipo_atraso,
    situacao_prazo = EXCLUDED.situacao_prazo, vence_em_dias = EXCLUDED.vence_em_dias,
    criado_no_compras_em = EXCLUDED.criado_no_compras_em,
    atualizado_no_compras_em = EXCLUDED.atualizado_no_compras_em,
    sincronizado_em = now(), removido_em = NULL;
  GET DIAGNOSTICS v_sol = ROW_COUNT;

  -- 3) itens (só de solicitações que vieram na foto)
  INSERT INTO public.compras_solicitacao_itens AS t (
    id, solicitacao_id, descricao, quantidade, unidade, ambiente, categoria, especificacao,
    referencia_projeto, observacao, sincronizado_em, removido_em)
  SELECT (i->>'id')::uuid, (i->>'solicitacao_id')::uuid, i->>'descricao', (i->>'quantidade')::numeric,
         i->>'unidade', i->>'ambiente', i->>'categoria', i->>'especificacao',
         i->>'referencia_projeto', i->>'observacao', now(), NULL
  FROM jsonb_array_elements(p_itens) i
  WHERE EXISTS (SELECT 1 FROM public.compras_solicitacoes s WHERE s.id = (i->>'solicitacao_id')::uuid)
  ON CONFLICT (id) DO UPDATE SET
    solicitacao_id = EXCLUDED.solicitacao_id, descricao = EXCLUDED.descricao,
    quantidade = EXCLUDED.quantidade, unidade = EXCLUDED.unidade, ambiente = EXCLUDED.ambiente,
    categoria = EXCLUDED.categoria, especificacao = EXCLUDED.especificacao,
    referencia_projeto = EXCLUDED.referencia_projeto, observacao = EXCLUDED.observacao,
    sincronizado_em = now(), removido_em = NULL;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  -- 4) compras registradas
  INSERT INTO public.compras_pedidos AS t (
    id, solicitacao_id, fornecedor, descricao_itens, valor_total, forma_pagamento, numero_pedido,
    data_compra, previsao_entrega, local_entrega, data_entrega_real, recebido_por,
    sincronizado_em, removido_em)
  SELECT (c->>'id')::uuid, (c->>'solicitacao_id')::uuid, c->>'fornecedor', c->>'descricao_itens',
         (c->>'valor_total')::numeric, c->>'forma_pagamento', c->>'numero_pedido',
         (c->>'data_compra')::date, (c->>'previsao_entrega')::date, c->>'local_entrega',
         (c->>'data_entrega_real')::date, c->>'recebido_por', now(), NULL
  FROM jsonb_array_elements(p_pedidos) c
  WHERE EXISTS (SELECT 1 FROM public.compras_solicitacoes s WHERE s.id = (c->>'solicitacao_id')::uuid)
  ON CONFLICT (id) DO UPDATE SET
    solicitacao_id = EXCLUDED.solicitacao_id, fornecedor = EXCLUDED.fornecedor,
    descricao_itens = EXCLUDED.descricao_itens, valor_total = EXCLUDED.valor_total,
    forma_pagamento = EXCLUDED.forma_pagamento, numero_pedido = EXCLUDED.numero_pedido,
    data_compra = EXCLUDED.data_compra, previsao_entrega = EXCLUDED.previsao_entrega,
    local_entrega = EXCLUDED.local_entrega, data_entrega_real = EXCLUDED.data_entrega_real,
    recebido_por = EXCLUDED.recebido_por, sincronizado_em = now(), removido_em = NULL;
  GET DIAGNOSTICS v_ped = ROW_COUNT;

  -- 5) o que não veio na foto: marca como removido (não apaga)
  UPDATE public.compras_solicitacoes t SET removido_em = now()
   WHERE t.removido_em IS NULL AND t.id NOT IN (
     SELECT (s->>'id')::uuid FROM jsonb_array_elements(p_solicitacoes) s);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rem := v_rem + v_n;
  UPDATE public.compras_solicitacao_itens t SET removido_em = now()
   WHERE t.removido_em IS NULL AND t.id NOT IN (
     SELECT (i->>'id')::uuid FROM jsonb_array_elements(p_itens) i);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rem := v_rem + v_n;
  UPDATE public.compras_pedidos t SET removido_em = now()
   WHERE t.removido_em IS NULL AND t.id NOT IN (
     SELECT (c->>'id')::uuid FROM jsonb_array_elements(p_pedidos) c);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rem := v_rem + v_n;

  UPDATE public.compras_sync_execucoes
     SET terminado_em = now(), ok = true, solicitacoes = v_sol, itens = v_itens,
         pedidos = v_ped, obras_novas = v_obras_novas, removidos = v_rem, erro = NULL
   WHERE id = p_execucao;

  RETURN jsonb_build_object('solicitacoes', v_sol, 'itens', v_itens, 'pedidos', v_ped,
                            'obras_novas', v_obras_novas, 'removidos', v_rem);
END $$;

-- Quem pode chamar o quê
REVOKE ALL ON FUNCTION public.compras_sync_token_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compras_sync_iniciar(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compras_sync_falhar(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compras_sync_aplicar(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compras_sync_token_ok(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.compras_sync_iniciar(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.compras_sync_falhar(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.compras_sync_aplicar(uuid, jsonb, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.compras_decidir_vinculo(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_decidir_vinculo(uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.compras_pode_conciliar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_pode_conciliar(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.compras_nome_de(uuid) FROM PUBLIC, anon, authenticated;

-- ───────────────────────── agendamento (a cada 5 minutos) ─────────────────────────
-- Precisa de pg_cron e pg_net. Se não existirem, a migração segue e o botão
-- "Atualizar agora" continua funcionando.
DO $$
DECLARE
  v_url text := 'https://fvblcyzdcqkiihyhfrrw.supabase.co/functions/v1/sync-compras-pull';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('compras-sync-a-cada-5-min');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'compras-sync-a-cada-5-min', '*/5 * * * *',
      format($job$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object('Content-Type', 'application/json',
            'x-compras-sync-token', (SELECT cron_token FROM public.compras_sync_config WHERE id)),
          body := '{"origem":"agendado"}'::jsonb)
      $job$, v_url));
  ELSE
    RAISE NOTICE 'pg_cron/pg_net ausentes: agendamento do Compras não criado.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento do Compras não criado: %', SQLERRM;
END $$;
