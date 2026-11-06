ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.subtract_business_days_simple(p date, n int) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := p; k int := 0;
BEGIN
  WHILE k < greatest(coalesce(n,0),0) LOOP
    d := d - 1;
    IF public.is_business_day(d) THEN k := k + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- Prazo do fornecedor confirmado é em DIAS ÚTEIS:
-- limite = precisa − N dias úteis; ideal = limite − 7 dias corridos (dia útil anterior).
CREATE OR REPLACE FUNCTION public.schedule_purchase_dates(
  p_rule jsonb, p_base date, p_ref date, p_lead int, p_lead_confirmed boolean
) RETURNS TABLE(precisa date, ideal date, limite date, reminder date, expected date, alert text)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_regra text := coalesce(p_rule->>'regra', 'padrao');
  v_dias int := coalesce((p_rule->>'dias')::int, 7);
  v_lim date;
BEGIN
  precisa := public.next_business_day(p_base);
  reminder := NULL; expected := NULL; alert := NULL;
  IF v_regra = 'marco' THEN
    precisa := p_base; ideal := p_base; limite := p_base;
    IF (p_rule->>'entrega_dias') IS NOT NULL THEN
      expected := public.next_business_day(p_base + (p_rule->>'entrega_dias')::int);
      IF p_ref IS NOT NULL AND expected >= p_ref THEN
        alert := 'Entrega prevista em ' || to_char(expected,'DD/MM/YYYY') || ' cai no dia da montagem ou depois (' || to_char(p_ref,'DD/MM/YYYY') || ').';
      END IF;
    ELSIF p_rule->>'ref' = 'instalacao_box' AND p_ref IS NOT NULL AND (p_ref - p_base) < 20 THEN
      alert := 'Medição a ' || (p_ref - p_base) || ' dias corridos da instalação do box (mínimo 20).';
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  IF v_regra = 'marmoraria' THEN
    precisa := public.next_business_day(p_base - 14);
  END IF;
  IF coalesce(p_lead_confirmed, false) AND p_lead IS NOT NULL AND coalesce((p_rule->>'prazo_confirmar')::boolean, false) THEN
    limite := public.subtract_business_days_simple(precisa, p_lead);
    ideal := public.prev_business_day(limite - 7);
  ELSE
    IF v_regra = 'limite' THEN v_lim := precisa - v_dias; ELSE v_lim := precisa - 7; END IF;
    limite := public.prev_business_day(v_lim);
    ideal := public.prev_business_day(v_lim - 7);
  END IF;
  IF (p_rule->>'agendar_instalacao_dias') IS NOT NULL THEN
    reminder := public.prev_business_day(precisa - (p_rule->>'agendar_instalacao_dias')::int);
  END IF;
  RETURN NEXT;
END $$;

-- Aviso ao papel suprimentos quando o cronograma gera compras.
CREATE OR REPLACE FUNCTION public.notify_schedule_purchases(p_project_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text; v_start date; v_total int; v_min date; v_m int;
  v_urgent boolean; v_list text; v_body text; v_sunday date;
  u uuid;
BEGIN
  SELECT name, planned_start_date INTO v_name, v_start FROM public.projects WHERE id = p_project_id;
  SELECT count(*), min(purchase_deadline_date) INTO v_total, v_min
    FROM public.project_purchases WHERE project_id = p_project_id AND auto_generated;
  IF coalesce(v_total,0) = 0 THEN RETURN; END IF;
  SELECT count(*) INTO v_m FROM public.project_purchases
    WHERE project_id = p_project_id AND auto_generated AND purchase_deadline_date = v_min;
  v_body := 'Obra ' || coalesce(v_name,'sem nome') || ' cadastrada: ' || v_total || ' compras geradas. '
    || v_m || ' precisa' || CASE WHEN v_m = 1 THEN '' ELSE 'm' END
    || ' ser encomendada' || CASE WHEN v_m = 1 THEN '' ELSE 's' END
    || ' até ' || to_char(v_min, 'DD/MM/YYYY') || '.';
  v_urgent := v_start IS NOT NULL AND (v_start - CURRENT_DATE) < 14;
  IF v_urgent THEN
    v_sunday := date_trunc('week', CURRENT_DATE)::date + 6;
    SELECT string_agg(item_name || ' (' || to_char(purchase_deadline_date,'DD/MM') || ')', ', ' ORDER BY purchase_deadline_date, item_name)
      INTO v_list
      FROM public.project_purchases
      WHERE project_id = p_project_id AND auto_generated AND status = 'pending'
        AND purchase_deadline_date <= v_sunday;
    IF v_list IS NOT NULL THEN
      v_body := v_body || ' Vencidas ou desta semana: ' || v_list || '.';
    END IF;
  END IF;
  FOR u IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    LEFT JOIN public.users_profile up ON up.id = ur.user_id
    WHERE ur.role = 'suprimentos' AND coalesce(up.status::text, 'ativo') = 'ativo'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, project_id, action_url, is_urgent)
    VALUES (u, 'general',
      CASE WHEN v_urgent THEN 'Urgente: compras da obra ' ELSE 'Compras geradas: ' END || coalesce(v_name,''),
      v_body, p_project_id, '/obra/' || p_project_id || '/compras', v_urgent);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.notify_schedule_purchases(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_schedule_purchases(p_project_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  it jsonb; v_id uuid; v_count int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) OR NOT public.has_project_access(v_uid, p_project_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar compras nesta obra' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RETURN 0; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.project_activities a
                   WHERE a.id = (it->>'activity_id')::uuid AND a.project_id = p_project_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.project_purchases (
      project_id, activity_id, schedule_ref_activity_id, item_name, category,
      purchase_type, delivery_location, delivery_address, notes, status,
      required_by_date, created_by, auto_generated, template_item_key,
      schedule_rule, lead_time_confirmed
    ) VALUES (
      p_project_id, (it->>'activity_id')::uuid,
      (SELECT a.id FROM public.project_activities a WHERE a.id = nullif(it->>'ref_activity_id','')::uuid AND a.project_id = p_project_id),
      left(it->>'item_name', 200), it->>'category',
      CASE WHEN it->>'purchase_type' = 'prestador' THEN 'prestador' ELSE 'produto' END,
      coalesce(it->>'delivery_location', 'obra'), it->>'delivery_address', it->>'notes', 'pending',
      CURRENT_DATE, v_uid, true, it->>'template_item_key',
      it->'rule', NOT coalesce((it->'rule'->>'prazo_confirmar')::boolean, false)
    )
    ON CONFLICT (project_id, template_item_key) WHERE auto_generated AND template_item_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
      PERFORM public.recompute_schedule_purchase(v_id);
      v_count := v_count + 1;
    END IF;
    v_id := NULL;
  END LOOP;
  IF v_count > 0 THEN
    PERFORM public.notify_schedule_purchases(p_project_id);
  END IF;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.create_schedule_purchases(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_schedule_purchases(uuid, jsonb) TO authenticated, service_role;