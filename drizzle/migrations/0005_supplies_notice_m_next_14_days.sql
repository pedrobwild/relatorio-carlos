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
  -- M: pendentes com limite nos próximos 14 dias corridos ou já vencido.
  SELECT count(*) INTO v_m FROM public.project_purchases
    WHERE project_id = p_project_id AND auto_generated AND status = 'pending'
      AND purchase_deadline_date <= CURRENT_DATE + 14;
  v_body := 'Obra ' || coalesce(v_name,'sem nome') || ' cadastrada: ' || v_total || ' compras geradas. ';
  IF v_m = 0 THEN
    v_body := v_body || 'Nenhuma precisa ser encomendada nos próximos 14 dias.';
  ELSE
    v_body := v_body || v_m || ' precisa' || CASE WHEN v_m = 1 THEN '' ELSE 'm' END
      || ' ser encomendada' || CASE WHEN v_m = 1 THEN '' ELSE 's' END
      || ' até ' || to_char(v_min, 'DD/MM/YYYY') || '.';
  END IF;
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