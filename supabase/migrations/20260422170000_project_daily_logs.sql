-- =========================================================================
-- Registro diário de obra (Painel de Obras)
-- =========================================================================
-- Três tabelas normalizadas:
--   • project_daily_logs         → um registro por (projeto, data)
--   • project_daily_log_services → serviços em execução no dia
--   • project_daily_log_workers  → prestadores no local no dia
--
-- Decisões de modelagem:
--   • UNIQUE (project_id, log_date) para permitir UPSERT simples no front.
--   • Subrecursos em tabelas-filhas com ON DELETE CASCADE — ao apagar o
--     log do dia, itens somem junto.
--   • Campos de texto como TEXT (sem limite); datas como DATE; períodos
--     como DATE (início/fim); período dentro do dia como TIME.
--   • RLS: staff lê/escreve; admin deleta (mesmo padrão do painel).
--   • Trigger de updated_at e, quando um log é modificado, bump em
--     projects.painel_ultima_atualizacao para refletir em "Atualizado".
-- =========================================================================

-- ------------------------------------------------------------------
-- 1) Tabela principal
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_daily_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  log_date     date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_daily_logs_project_date_unique UNIQUE (project_id, log_date)
);

CREATE INDEX IF NOT EXISTS project_daily_logs_project_id_idx
  ON public.project_daily_logs (project_id, log_date DESC);

COMMENT ON TABLE public.project_daily_logs IS
  'Registro diário por obra (painel de obras). Um registro por (project_id, log_date).';

-- ------------------------------------------------------------------
-- 2) Serviços em execução no dia
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_daily_log_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id    uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
  description     text NOT NULL,
  status          text,        -- p.ex.: 'Em andamento', 'Concluído', 'Parado'
  observations    text,
  position        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_daily_log_services_log_id_idx
  ON public.project_daily_log_services (daily_log_id, position);

COMMENT ON TABLE public.project_daily_log_services IS
  'Serviços em execução listados no registro diário da obra.';

-- ------------------------------------------------------------------
-- 3) Prestadores no local no dia
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_daily_log_workers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id    uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text,        -- função / empresa / ofício
  period_start    date,        -- período de atuação (início)
  period_end      date,        -- período de atuação (fim)
  shift_start     time,        -- hora de entrada no dia
  shift_end       time,        -- hora de saída no dia
  notes           text,
  position        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_daily_log_workers_log_id_idx
  ON public.project_daily_log_workers (daily_log_id, position);

COMMENT ON TABLE public.project_daily_log_workers IS
  'Prestadores presentes no local no dia (nome, função, período e horário).';

-- ------------------------------------------------------------------
-- 4) Triggers
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_project_daily_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  -- Se estamos em UPDATE, o updated_by deve ser fornecido pelo caller
  -- (a repo seta). Em INSERT, também vem do caller.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_daily_logs_touch ON public.project_daily_logs;
CREATE TRIGGER trg_project_daily_logs_touch
BEFORE UPDATE ON public.project_daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.touch_project_daily_log();

-- Bump "Atualizado" da obra (painel) quando o log é alterado.
-- Vale para INSERT e UPDATE no log ou em qualquer tabela-filha.
CREATE OR REPLACE FUNCTION public.bump_project_last_painel_update_from_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'project_daily_logs' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSE
    -- tabelas-filhas: busca o project_id via daily_log_id
    SELECT l.project_id INTO v_project_id
    FROM public.project_daily_logs l
    WHERE l.id = COALESCE(NEW.daily_log_id, OLD.daily_log_id);
  END IF;

  IF v_project_id IS NOT NULL THEN
    UPDATE public.projects
      SET painel_ultima_atualizacao = now()
    WHERE id = v_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_project_daily_logs_bump ON public.project_daily_logs;
CREATE TRIGGER trg_project_daily_logs_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

DROP TRIGGER IF EXISTS trg_project_daily_log_services_bump ON public.project_daily_log_services;
CREATE TRIGGER trg_project_daily_log_services_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_log_services
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

DROP TRIGGER IF EXISTS trg_project_daily_log_workers_bump ON public.project_daily_log_workers;
CREATE TRIGGER trg_project_daily_log_workers_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_log_workers
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

-- ------------------------------------------------------------------
-- 5) Row-Level Security (mesmo padrão do painel)
-- ------------------------------------------------------------------
ALTER TABLE public.project_daily_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_log_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_log_workers  ENABLE ROW LEVEL SECURITY;

-- --- project_daily_logs ---
DROP POLICY IF EXISTS "Staff pode visualizar logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode visualizar logs diários"
  ON public.project_daily_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode inserir logs diários"
  ON public.project_daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode atualizar logs diários"
  ON public.project_daily_logs FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin pode deletar logs diários" ON public.project_daily_logs;
CREATE POLICY "Admin pode deletar logs diários"
  ON public.project_daily_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- --- project_daily_log_services ---
DROP POLICY IF EXISTS "Staff pode visualizar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode visualizar serviços do log"
  ON public.project_daily_log_services FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode inserir serviços do log"
  ON public.project_daily_log_services FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode atualizar serviços do log"
  ON public.project_daily_log_services FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode deletar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode deletar serviços do log"
  ON public.project_daily_log_services FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- --- project_daily_log_workers ---
DROP POLICY IF EXISTS "Staff pode visualizar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode visualizar prestadores do log"
  ON public.project_daily_log_workers FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode inserir prestadores do log"
  ON public.project_daily_log_workers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode atualizar prestadores do log"
  ON public.project_daily_log_workers FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode deletar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode deletar prestadores do log"
  ON public.project_daily_log_workers FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));
