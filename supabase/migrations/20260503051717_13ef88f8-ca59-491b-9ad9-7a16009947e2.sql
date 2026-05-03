
CREATE OR REPLACE FUNCTION public.sync_project_planned_dates_from_activities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_min date;
  v_max date;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Considera apenas atividades VÁLIDAS:
  --  * planned_start e planned_end não nulos
  --  * planned_end >= planned_start (sem datas invertidas)
  -- MAX/MIN naturalmente ignoram NULLs, mas filtramos explicitamente
  -- para também excluir linhas com início definido sem término (ou
  -- vice-versa) e linhas com intervalo invertido.
  SELECT MIN(planned_start), MAX(planned_end)
    INTO v_min, v_max
  FROM public.project_activities
  WHERE project_id    = v_project_id
    AND planned_start IS NOT NULL
    AND planned_end   IS NOT NULL
    AND planned_end  >= planned_start;

  -- Só atualiza quando há ao menos uma atividade válida; preserva
  -- valores existentes em projects caso contrário (evita zerar a
  -- entrega oficial por engano se todas as atividades estiverem
  -- incompletas/invertidas).
  IF v_min IS NOT NULL AND v_max IS NOT NULL THEN
    UPDATE public.projects
       SET planned_start_date = v_min,
           planned_end_date   = v_max,
           updated_at         = now()
     WHERE id = v_project_id
       AND (planned_start_date IS DISTINCT FROM v_min
            OR planned_end_date IS DISTINCT FROM v_max);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Re-backfill aplicando os mesmos filtros de validação.
UPDATE public.projects p
   SET planned_start_date = a.min_start,
       planned_end_date   = a.max_end,
       updated_at         = now()
  FROM (
    SELECT project_id,
           MIN(planned_start) AS min_start,
           MAX(planned_end)   AS max_end
      FROM public.project_activities
     WHERE planned_start IS NOT NULL
       AND planned_end   IS NOT NULL
       AND planned_end  >= planned_start
     GROUP BY project_id
  ) a
 WHERE a.project_id = p.id
   AND a.min_start IS NOT NULL
   AND a.max_end   IS NOT NULL
   AND (p.planned_start_date IS DISTINCT FROM a.min_start
        OR p.planned_end_date IS DISTINCT FROM a.max_end);
