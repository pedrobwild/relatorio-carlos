CREATE OR REPLACE FUNCTION public.replace_project_activities(
  p_project_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb;
  v_id uuid;
  v_incoming_ids uuid[] := '{}'::uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_edit_atividades(p_project_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar o cronograma desta obra';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'O cronograma deve ser enviado como uma lista de atividades';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_id := COALESCE(NULLIF(v_row->>'id', '')::uuid, gen_random_uuid());

    IF v_id = ANY(v_incoming_ids) THEN
      RAISE EXCEPTION 'O cronograma contém atividades duplicadas';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.project_activities
      WHERE id = v_id
        AND project_id <> p_project_id
    ) THEN
      RAISE EXCEPTION 'Uma atividade informada pertence a outra obra';
    END IF;

    v_incoming_ids := array_append(v_incoming_ids, v_id);

    INSERT INTO public.project_activities (
      id,
      project_id,
      description,
      planned_start,
      planned_end,
      actual_start,
      actual_end,
      weight,
      sort_order,
      created_by,
      predecessor_ids,
      etapa,
      detailed_description
    )
    VALUES (
      v_id,
      p_project_id,
      btrim(v_row->>'description'),
      (v_row->>'planned_start')::date,
      (v_row->>'planned_end')::date,
      NULLIF(v_row->>'actual_start', '')::date,
      NULLIF(v_row->>'actual_end', '')::date,
      COALESCE((v_row->>'weight')::numeric, 0),
      COALESCE((v_row->>'sort_order')::integer, 0),
      auth.uid(),
      COALESCE(
        (SELECT array_agg(elem::uuid) FROM jsonb_array_elements_text(COALESCE(v_row->'predecessor_ids', '[]'::jsonb)) elem),
        '{}'::uuid[]
      ),
      NULLIF(btrim(v_row->>'etapa'), ''),
      NULLIF(btrim(v_row->>'detailed_description'), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      description = EXCLUDED.description,
      planned_start = EXCLUDED.planned_start,
      planned_end = EXCLUDED.planned_end,
      actual_start = EXCLUDED.actual_start,
      actual_end = EXCLUDED.actual_end,
      weight = EXCLUDED.weight,
      sort_order = EXCLUDED.sort_order,
      predecessor_ids = EXCLUDED.predecessor_ids,
      etapa = EXCLUDED.etapa,
      detailed_description = EXCLUDED.detailed_description;
  END LOOP;

  DELETE FROM public.project_activities
  WHERE project_id = p_project_id
    AND NOT (id = ANY(v_incoming_ids));
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_project_activities(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_project_activities(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_project_activities(uuid, jsonb) TO service_role;