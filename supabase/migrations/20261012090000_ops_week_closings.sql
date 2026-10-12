-- =====================================================================
-- Fase 6 (parte 1): FECHAMENTO DE SEMANA e PPC
--
-- Fechar a semana registra o retrato do que foi planejado e do que foi
-- feito na obra naquela semana. O PPC (dias feitos ÷ dias marcados) sai
-- daqui — o gestor não digita indicador nenhum, só confirma os dias.
--
-- Os números são calculados no banco, a partir de ops_assignments, no
-- momento do fechamento: o app só informa a obra, a segunda-feira da semana
-- e uma observação opcional. Só fecha quando todos os dias marcados da
-- semana estão confirmados (Feito / Não feito).
--
-- Reabrir = apagar o fechamento. Fechar de novo = atualizar o retrato.
--
-- RLS: somente staff com acesso à obra. Nenhuma policy para cliente.
-- Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ops_week_closings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start  date NOT NULL,                       -- segunda-feira da semana
  planned     integer NOT NULL DEFAULT 0,          -- dias marcados na semana (calculado)
  done        integer NOT NULL DEFAULT 0,          -- confirmados como feitos (calculado)
  not_done    integer NOT NULL DEFAULT 0,          -- confirmados como não feitos (calculado)
  reasons     jsonb   NOT NULL DEFAULT '{}'::jsonb, -- motivo do não feito → quantidade (calculado)
  notes       text,
  closed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_week_closings_monday_chk CHECK (extract(isodow FROM week_start) = 1),
  CONSTRAINT ops_week_closings_counts_chk CHECK (planned > 0 AND done >= 0 AND not_done >= 0 AND done + not_done = planned),
  CONSTRAINT ops_week_closings_project_week_key UNIQUE (project_id, week_start)
);

CREATE INDEX IF NOT EXISTS ops_week_closings_week_idx ON public.ops_week_closings (week_start, project_id);

COMMENT ON TABLE public.ops_week_closings IS
  'Fechamento de semana por obra: retrato de dias marcados × feitos (PPC). Somente staff.';

-- Calcula o retrato no banco e recusa fechar semana incompleta.
CREATE OR REPLACE FUNCTION public.ops_week_closings_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_today   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_planned integer;
  v_done    integer;
  v_not     integer;
  v_pending integer;
  v_reasons jsonb;
BEGIN
  -- Apagar o usuário que fechou zera closed_by (ON DELETE SET NULL). Isso não
  -- é um novo fechamento: o retrato fica como está, em vez de ser recalculado
  -- (ou de impedir a exclusão do usuário se algum dia foi desfeito depois).
  -- (Só esse caso: "atualizar fechamento" sem mudar a observação também chega
  -- como UPDATE sem diferença nas outras colunas, e precisa recalcular.)
  IF TG_OP = 'UPDATE'
     AND OLD.closed_by IS NOT NULL AND NEW.closed_by IS NULL
     AND (to_jsonb(NEW) - 'closed_by') = (to_jsonb(OLD) - 'closed_by') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.project_id IS DISTINCT FROM OLD.project_id
                           OR NEW.week_start IS DISTINCT FROM OLD.week_start) THEN
    RAISE EXCEPTION 'Não é possível mover um fechamento para outra obra ou semana' USING ERRCODE = '23514';
  END IF;
  IF NEW.week_start > v_today THEN
    RAISE EXCEPTION 'Esta semana ainda não começou' USING ERRCODE = '23514';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE a.outcome = 'feito'),
         count(*) FILTER (WHERE a.outcome = 'nao_feito'),
         count(*) FILTER (WHERE a.outcome IS NULL)
    INTO v_planned, v_done, v_not, v_pending
    FROM public.ops_assignments a
   WHERE a.project_id = NEW.project_id
     AND a.work_date BETWEEN NEW.week_start AND NEW.week_start + 6;

  IF v_planned = 0 THEN
    RAISE EXCEPTION 'Nada foi marcado nesta semana: não há o que fechar' USING ERRCODE = '23514';
  END IF;
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Ainda há % dia(s) sem confirmação nesta semana', v_pending USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(jsonb_object_agg(r.reason, r.n), '{}'::jsonb)
    INTO v_reasons
    FROM (
      SELECT a.not_done_reason::text AS reason, count(*) AS n
        FROM public.ops_assignments a
       WHERE a.project_id = NEW.project_id
         AND a.work_date BETWEEN NEW.week_start AND NEW.week_start + 6
         AND a.outcome = 'nao_feito'
         AND a.not_done_reason IS NOT NULL
       GROUP BY a.not_done_reason
    ) r;

  NEW.planned   := v_planned;
  NEW.done      := v_done;
  NEW.not_done  := v_not;
  NEW.reasons   := v_reasons;
  NEW.notes     := nullif(btrim(NEW.notes), '');
  NEW.closed_at := now();
  NEW.closed_by := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ops_week_closings_snapshot_trg ON public.ops_week_closings;
CREATE TRIGGER ops_week_closings_snapshot_trg
  BEFORE INSERT OR UPDATE ON public.ops_week_closings
  FOR EACH ROW EXECUTE FUNCTION public.ops_week_closings_snapshot();

-- RLS: somente staff com acesso à obra --------------------------------
ALTER TABLE public.ops_week_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_week_closings_staff_all ON public.ops_week_closings;
CREATE POLICY ops_week_closings_staff_all ON public.ops_week_closings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

REVOKE ALL ON public.ops_week_closings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_week_closings TO authenticated;
