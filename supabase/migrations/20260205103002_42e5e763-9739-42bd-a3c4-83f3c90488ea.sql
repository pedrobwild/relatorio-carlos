-- Create table for Customer Success Manager section in journey
CREATE TABLE public.journey_csm (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Victorya Capponi',
  role_title TEXT NOT NULL DEFAULT 'Gerente de Sucesso do Cliente',
  description TEXT NOT NULL DEFAULT 'Victorya Capponi é a Gerente de Sucesso do Cliente da Bwild e será o seu principal ponto de contato ao longo da jornada.

Ela é responsável por:
• Garantir um atendimento próximo, claro e organizado
• Acompanhar sua experiência do início ao fim
• Coletar feedbacks e zelar pela qualidade da sua jornada
• Conduzir os trâmites necessários para a liberação da obra junto ao condomínio

Na prática, Victorya é a sua voz dentro da Bwild — alguém que entende suas necessidades, antecipa pontos de atenção e trabalha para que cada etapa do processo aconteça da forma mais fluida possível.

Sempre que precisar, você pode contar com ela.',
  email TEXT DEFAULT 'victorya@bwild.com.br',
  phone TEXT DEFAULT '(51) 98557-0235',
  photo_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT journey_csm_project_id_key UNIQUE (project_id)
);

-- Enable RLS
ALTER TABLE public.journey_csm ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view journey_csm for their projects"
ON public.journey_csm
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = journey_csm.project_id
    AND pm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('admin', 'manager', 'engineer')
  )
);

CREATE POLICY "Admins can manage journey_csm"
ON public.journey_csm
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('admin', 'manager', 'engineer')
  )
);

-- Update timestamp trigger
CREATE TRIGGER update_journey_csm_updated_at
BEFORE UPDATE ON public.journey_csm
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update initialize_project_journey function to also create CSM record
CREATE OR REPLACE FUNCTION public.initialize_project_journey(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_name TEXT;
BEGIN
  -- Get project name
  SELECT name INTO v_project_name FROM projects WHERE id = p_project_id;

  -- Insert hero if not exists
  INSERT INTO journey_hero (project_id, title, subtitle, badge_text)
  VALUES (
    p_project_id,
    'Sua jornada com a Bwild começou!',
    'Acompanhe aqui cada etapa do desenvolvimento do seu projeto. Sempre que houver novidades ou ações necessárias, você será notificado.',
    'Fase de Projeto'
  )
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert CSM if not exists
  INSERT INTO journey_csm (project_id)
  VALUES (p_project_id)
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert footer if not exists
  INSERT INTO journey_footer (project_id, text)
  VALUES (
    p_project_id,
    'Estamos aqui para transformar seu espaço em algo único. Qualquer dúvida, entre em contato com nossa equipe!'
  )
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert default stages if none exist
  IF NOT EXISTS (SELECT 1 FROM journey_stages WHERE project_id = p_project_id) THEN
    INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description) VALUES
    (p_project_id, 1, 'Briefing de Arquitetura', 'clipboard-list', 'in_progress', 'Reunião inicial para entender suas necessidades e preferências.'),
    (p_project_id, 2, 'Projeto 3D', 'cube', 'pending', 'Desenvolvimento da proposta visual em 3D.'),
    (p_project_id, 3, 'Medição Técnica', 'ruler', 'pending', 'Visita técnica para medições precisas do espaço.'),
    (p_project_id, 4, 'Projeto Executivo', 'file-text', 'pending', 'Detalhamento técnico para execução da obra.'),
    (p_project_id, 5, 'Aprovações', 'check-circle', 'pending', 'Aprovação dos projetos e orçamentos.'),
    (p_project_id, 6, 'Liberação', 'building', 'pending', 'Liberação da obra junto ao condomínio.');
  END IF;
END;
$$;