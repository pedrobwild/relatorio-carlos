ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_item_key text,
  ADD COLUMN IF NOT EXISTS purchase_deadline_date date,
  ADD COLUMN IF NOT EXISTS lead_time_confirmed boolean,
  ADD COLUMN IF NOT EXISTS reminder_date date,
  ADD COLUMN IF NOT EXISTS schedule_rule jsonb,
  ADD COLUMN IF NOT EXISTS schedule_ref_activity_id uuid REFERENCES public.project_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_alert text,
  ADD COLUMN IF NOT EXISTS schedule_conflict boolean NOT NULL DEFAULT false;

ALTER TABLE public.project_purchases DROP CONSTRAINT IF EXISTS chk_delivery_location;
ALTER TABLE public.project_purchases ADD CONSTRAINT chk_delivery_location
  CHECK (delivery_location IS NULL OR delivery_location = ANY (ARRAY['obra','estoque','escritorio','retirada','fornecedor']));

CREATE INDEX IF NOT EXISTS idx_project_purchases_auto_activity
  ON public.project_purchases(activity_id) WHERE auto_generated;
CREATE INDEX IF NOT EXISTS idx_project_purchases_auto_ref
  ON public.project_purchases(schedule_ref_activity_id) WHERE auto_generated;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_purchases_template_key
  ON public.project_purchases(project_id, template_item_key) WHERE auto_generated AND template_item_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prev_business_day(p date) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := p;
BEGIN
  WHILE NOT public.is_business_day(d) LOOP d := d - 1; END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.next_business_day(p date) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := p;
BEGIN
  WHILE NOT public.is_business_day(d) LOOP d := d + 1; END LOOP;
  RETURN d;
END $$;

-- Regras de data das compras geradas pelo cronograma (dias corridos para trás).
-- Pedido em dia não útil volta ao dia útil anterior; entrega vai ao próximo.
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
  IF coalesce(p_lead_confirmed, false) AND p_lead IS NOT NULL THEN
    v_lim := precisa - p_lead;
  ELSIF v_regra = 'limite' THEN
    v_lim := precisa - v_dias;
  ELSE
    v_lim := precisa - 7;
  END IF;
  limite := public.prev_business_day(v_lim);
  ideal := public.prev_business_day(v_lim - 7);
  IF (p_rule->>'agendar_instalacao_dias') IS NOT NULL THEN
    reminder := public.prev_business_day(precisa - (p_rule->>'agendar_instalacao_dias')::int);
  END IF;
  RETURN NEXT;
END $$;

-- Recalcula uma compra gerada. Pendente: novas datas. Já feita: só marca conflito.
CREATE OR REPLACE FUNCTION public.recompute_schedule_purchase(p_purchase_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.project_purchases%ROWTYPE;
  v_base date; v_ref date; r record;
BEGIN
  SELECT * INTO p FROM public.project_purchases WHERE id = p_purchase_id;
  IF NOT FOUND OR NOT p.auto_generated OR p.schedule_rule IS NULL THEN RETURN; END IF;
  SELECT planned_start INTO v_base FROM public.project_activities WHERE id = p.activity_id;
  IF v_base IS NULL THEN RETURN; END IF;
  SELECT planned_start INTO v_ref FROM public.project_activities WHERE id = p.schedule_ref_activity_id;
  SELECT * INTO r FROM public.schedule_purchase_dates(p.schedule_rule, v_base, v_ref, p.lead_time_days, p.lead_time_confirmed);
  IF p.status = 'pending' THEN
    UPDATE public.project_purchases SET
      required_by_date = r.precisa,
      planned_purchase_date = r.ideal,
      purchase_deadline_date = r.limite,
      reminder_date = r.reminder,
      expected_delivery_date = coalesce(r.expected, expected_delivery_date),
      schedule_alert = r.alert,
      schedule_conflict = false,
      updated_at = now()
    WHERE id = p.id;
  ELSE
    UPDATE public.project_purchases SET
      schedule_conflict = (p.expected_delivery_date IS NOT NULL AND r.precisa < p.expected_delivery_date),
      updated_at = now()
    WHERE id = p.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.recompute_schedule_purchase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_schedule_purchase(uuid) TO service_role;

-- Cria as compras do cronograma semanal. p_items: [{activity_id, ref_activity_id,
-- item_name, category, purchase_type, delivery_location, delivery_address,
-- template_item_key, notes, rule}]
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
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.create_schedule_purchases(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_schedule_purchases(uuid, jsonb) TO authenticated, service_role;

-- Suprimentos informa o prazo do fornecedor.
CREATE OR REPLACE FUNCTION public.confirm_purchase_lead_time(p_purchase_id uuid, p_days int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_project uuid;
BEGIN
  SELECT project_id INTO v_project FROM public.project_purchases WHERE id = p_purchase_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) OR NOT public.has_project_access(v_uid, v_project) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  IF p_days IS NULL OR p_days < 0 OR p_days > 365 THEN RAISE EXCEPTION 'Prazo inválido'; END IF;
  UPDATE public.project_purchases SET lead_time_days = p_days, lead_time_confirmed = true, updated_at = now()
  WHERE id = p_purchase_id;
  PERFORM public.recompute_schedule_purchase(p_purchase_id);
END $$;
REVOKE ALL ON FUNCTION public.confirm_purchase_lead_time(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_lead_time(uuid, int) TO authenticated, service_role;

-- Ao mudar o início de uma semana, recalcula as compras geradas ligadas a ela
-- (inclui os marcos da mesma semana) e as que a usam como referência.
CREATE OR REPLACE FUNCTION public.trg_recompute_schedule_purchases() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NEW.planned_start IS NOT DISTINCT FROM OLD.planned_start THEN RETURN NEW; END IF;
  FOR v_id IN
    SELECT id FROM public.project_purchases
    WHERE auto_generated AND (activity_id = NEW.id OR schedule_ref_activity_id = NEW.id)
  LOOP
    PERFORM public.recompute_schedule_purchase(v_id);
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS project_activities_recompute_purchases ON public.project_activities;
CREATE TRIGGER project_activities_recompute_purchases
  AFTER UPDATE OF planned_start ON public.project_activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_schedule_purchases();