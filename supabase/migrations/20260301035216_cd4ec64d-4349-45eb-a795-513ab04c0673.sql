
-- Rename existing "Aprovações" stages to "Liberação da Obra"
UPDATE public.journey_stages 
SET name = 'Liberação da Obra', icon = 'shield-check'
WHERE name IN ('Aprovações', 'Aprovações e Documentação');

-- Update the initialize_project_journey function to use new name
CREATE OR REPLACE FUNCTION public.initialize_project_journey(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_count int;
  v_stage_id uuid;
BEGIN
  SELECT count(*) INTO v_stage_count FROM journey_stages WHERE project_id = p_project_id;
  IF v_stage_count = 0 THEN
    INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description)
    VALUES
      (p_project_id, 1, 'Briefing', 'message-circle', 'in_progress', 'Reunião inicial para alinhamento do projeto.'),
      (p_project_id, 2, 'Projeto 3D', 'box', 'pending', 'Desenvolvimento do projeto em 3D para aprovação.'),
      (p_project_id, 3, 'Medição Técnica', 'ruler', 'pending', 'Visita técnica para medições precisas do espaço.'),
      (p_project_id, 4, 'Projeto Executivo', 'file-text', 'pending', 'Detalhamento técnico para execução da obra.'),
      (p_project_id, 5, 'Liberação da Obra', 'shield-check', 'pending', 'Trâmites para emissão da ART e aprovação do condomínio para início da obra.'),
      (p_project_id, 6, 'Mobilização', 'hard-hat', 'pending', 'Mobilização da equipe técnica para início da obra.');
  END IF;

  -- Create hero
  INSERT INTO journey_hero (project_id, title, subtitle)
  VALUES (p_project_id, 'Jornada do Projeto', 'Acompanhe cada etapa da sua reforma')
  ON CONFLICT (project_id) DO NOTHING;

  -- Create footer
  INSERT INTO journey_footer (project_id, text)
  VALUES (p_project_id, 'Estamos com você em cada etapa.')
  ON CONFLICT (project_id) DO NOTHING;
END;
$$;
