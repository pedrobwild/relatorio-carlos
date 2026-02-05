-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop type if exists (this will cascade drop related objects)
DROP TYPE IF EXISTS public.journey_stage_status CASCADE;

-- Enum for journey stage status
CREATE TYPE public.journey_stage_status AS ENUM ('pending', 'waiting_action', 'in_progress', 'completed');

-- Hero section content (editable by admin)
CREATE TABLE IF NOT EXISTS public.journey_hero (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  title TEXT NOT NULL DEFAULT '✨ Sua jornada com a Bwild começou',
  subtitle TEXT NOT NULL DEFAULT 'A partir de agora, nosso time cuida de todas as etapas da sua reforma — do projeto à liberação da obra, com método, transparência e atenção aos detalhes.',
  badge_text TEXT DEFAULT '🟢 Contrato assinado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Footer section content (editable by admin)
CREATE TABLE IF NOT EXISTS public.journey_footer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  text TEXT NOT NULL DEFAULT 'Estamos muito felizes em ter você com a Bwild.

Nosso compromisso é conduzir sua reforma com organização, clareza e cuidado em cada detalhe.
Seguimos juntos para transformar esse projeto em realidade.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journey stages (editable by admin)
CREATE TABLE IF NOT EXISTS public.journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  status public.journey_stage_status NOT NULL DEFAULT 'pending',
  description TEXT,
  warning_text TEXT,
  cta_text TEXT,
  cta_url TEXT,
  cta_visible BOOLEAN NOT NULL DEFAULT true,
  microcopy TEXT,
  responsible TEXT,
  dependencies_text TEXT,
  revision_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, sort_order)
);

-- Journey todos (checklists for each stage)
CREATE TABLE IF NOT EXISTS public.journey_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  owner TEXT NOT NULL CHECK (owner IN ('client', 'bwild')),
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journey_hero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_footer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_todos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Users with project access can view journey hero" ON public.journey_hero;
DROP POLICY IF EXISTS "Staff can manage journey hero" ON public.journey_hero;
DROP POLICY IF EXISTS "Users with project access can view journey footer" ON public.journey_footer;
DROP POLICY IF EXISTS "Staff can manage journey footer" ON public.journey_footer;
DROP POLICY IF EXISTS "Users with project access can view journey stages" ON public.journey_stages;
DROP POLICY IF EXISTS "Staff can manage journey stages" ON public.journey_stages;
DROP POLICY IF EXISTS "Users with project access can view journey todos" ON public.journey_todos;
DROP POLICY IF EXISTS "Staff can manage journey todos" ON public.journey_todos;
DROP POLICY IF EXISTS "Clients can update their own todos" ON public.journey_todos;

-- RLS Policies for journey_hero
CREATE POLICY "Users with project access can view journey hero"
  ON public.journey_hero FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage journey hero"
  ON public.journey_hero FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

-- RLS Policies for journey_footer
CREATE POLICY "Users with project access can view journey footer"
  ON public.journey_footer FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage journey footer"
  ON public.journey_footer FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

-- RLS Policies for journey_stages
CREATE POLICY "Users with project access can view journey stages"
  ON public.journey_stages FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage journey stages"
  ON public.journey_stages FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

-- RLS Policies for journey_todos
CREATE POLICY "Users with project access can view journey todos"
  ON public.journey_todos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.journey_stages js
      WHERE js.id = journey_todos.stage_id
      AND public.has_project_access(auth.uid(), js.project_id)
    )
  );

CREATE POLICY "Staff can manage journey todos"
  ON public.journey_todos FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Clients can update their own todos"
  ON public.journey_todos FOR UPDATE
  USING (
    owner = 'client' AND
    EXISTS (
      SELECT 1 FROM public.journey_stages js
      WHERE js.id = journey_todos.stage_id
      AND public.has_project_access(auth.uid(), js.project_id)
    )
  )
  WITH CHECK (
    owner = 'client' AND
    EXISTS (
      SELECT 1 FROM public.journey_stages js
      WHERE js.id = journey_todos.stage_id
      AND public.has_project_access(auth.uid(), js.project_id)
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_journey_hero_updated_at ON public.journey_hero;
CREATE TRIGGER update_journey_hero_updated_at
  BEFORE UPDATE ON public.journey_hero
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_journey_footer_updated_at ON public.journey_footer;
CREATE TRIGGER update_journey_footer_updated_at
  BEFORE UPDATE ON public.journey_footer
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_journey_stages_updated_at ON public.journey_stages;
CREATE TRIGGER update_journey_stages_updated_at
  BEFORE UPDATE ON public.journey_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize journey for a project with default stages
CREATE OR REPLACE FUNCTION public.initialize_project_journey(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id UUID;
BEGIN
  -- Create hero
  INSERT INTO journey_hero (project_id) VALUES (p_project_id)
  ON CONFLICT (project_id) DO NOTHING;
  
  -- Create footer
  INSERT INTO journey_footer (project_id) VALUES (p_project_id)
  ON CONFLICT (project_id) DO NOTHING;
  
  -- Check if stages already exist
  IF EXISTS (SELECT 1 FROM journey_stages WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;
  
  -- Stage 1: Briefing de Arquitetura
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, cta_text, cta_visible, microcopy)
  VALUES (
    p_project_id, 1, 'Briefing de Arquitetura', 'clipboard-list', 'waiting_action',
    E'Nesta etapa, realizamos a reunião de briefing para alinhar todos os pontos essenciais para o desenvolvimento do Projeto 3D.\n\nVocê terá uma reunião com Lorena Alves, Head de Arquitetura da Bwild, para alinhar:\n\n• Objetivos do projeto\n• Uso do imóvel\n• Preferências estéticas e funcionais\n• Diretrizes técnicas e restrições do condomínio\n\nEssa conversa é fundamental para garantir que o Projeto 3D reflita exatamente o que faz sentido para você.',
    '📅 Escolher data da reunião', true, 'Essa reunião dá início ao desenvolvimento do seu Projeto 3D.'
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Enviar o Manual de Obras do condomínio', 1),
    (v_stage_id, 'client', 'Escolher uma das datas sugeridas para a reunião', 2),
    (v_stage_id, 'client', 'Solicitar a ligação de energia junto à ENEL', 3),
    (v_stage_id, 'client', 'Combinar a entrega das chaves da unidade com o time Bwild', 4),
    (v_stage_id, 'bwild', 'Analisar o Manual de Obras', 1),
    (v_stage_id, 'bwild', 'Confirmar data e horário da reunião', 2),
    (v_stage_id, 'bwild', 'Conduzir o briefing técnico e criativo', 3);

  -- Stage 2: Projeto 3D
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, revision_text, cta_text, cta_visible, microcopy)
  VALUES (
    p_project_id, 2, 'Projeto 3D', 'box', 'pending',
    E'Nesta etapa, você visualiza o conceito do seu imóvel através do Projeto 3D, que traduz os alinhamentos do briefing em uma proposta visual completa.\n\nO Projeto 3D apresenta:\n\n• Layout do apartamento\n• Distribuição de mobiliário\n• Estilo e soluções funcionais\n\nO objetivo é validar o conceito antes de avançarmos para o detalhamento técnico.',
    'Ajustes podem ser solicitados mediante alinhamento prévio com nosso time.',
    '✅ Aprovar Projeto 3D', true, 'A próxima etapa só é liberada após a aprovação do Projeto 3D pelo cliente.'
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Analisar o Projeto 3D', 1),
    (v_stage_id, 'client', 'Enviar considerações', 2),
    (v_stage_id, 'client', 'Aprovar o Projeto 3D', 3),
    (v_stage_id, 'bwild', 'Desenvolver o Projeto 3D', 1),
    (v_stage_id, 'bwild', 'Apresentar o conceito', 2),
    (v_stage_id, 'bwild', 'Ajustar, se necessário', 3);

  -- Stage 3: Medição Técnica
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, dependencies_text, responsible, cta_text, cta_visible, microcopy)
  VALUES (
    p_project_id, 3, 'Medição Técnica da Unidade', 'ruler', 'pending',
    E'Após a aprovação do Projeto 3D, realizamos a medição técnica completa da unidade para garantir precisão total no desenvolvimento do Projeto Executivo.\n\nEssa etapa permite:\n\n• Compatibilização técnica do projeto\n• Validação de medidas reais\n• Segurança nas decisões de obra',
    E'• Projeto 3D aprovado\n• Unidade entregue pela construtora\n• Chaves da unidade em posse da Bwild',
    'Engenheiro Bwild',
    '📐 Acompanhar status da medição', true, 'A medição ocorre após o Projeto 3D aprovado e com a unidade acessível.'
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Confirmar entrega das chaves à Bwild', 1),
    (v_stage_id, 'bwild', 'Realizar a medição técnica', 1),
    (v_stage_id, 'bwild', 'Registrar informações para o Projeto Executivo', 2);

  -- Stage 4: Projeto Executivo
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, warning_text, cta_text, cta_visible, microcopy)
  VALUES (
    p_project_id, 4, 'Projeto Executivo', 'file-text', 'pending',
    E'O Projeto Executivo é o documento técnico que transforma o conceito aprovado em obra.\n\nEle define com precisão:\n\n• Medidas finais\n• Infraestruturas\n• Materiais e especificações técnicas',
    '🔒 Após a aprovação do Projeto Executivo, não são realizadas alterações estruturais.',
    '✍️ Aprovar Projeto Executivo', true, 'Essa aprovação libera a etapa de documentação e planejamento da obra.'
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Analisar o Projeto Executivo', 1),
    (v_stage_id, 'client', 'Aprovar o Projeto Executivo', 2),
    (v_stage_id, 'bwild', 'Desenvolver o Projeto Executivo', 1),
    (v_stage_id, 'bwild', 'Garantir compatibilidade técnica e normativa', 2);

  -- Stage 5: Aprovações e Documentação
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, cta_text, cta_visible)
  VALUES (
    p_project_id, 5, 'Aprovações e Documentação', 'file-check', 'pending',
    E'Com o Projeto Executivo aprovado, iniciamos os trâmites técnicos e documentais necessários para a liberação da obra junto ao condomínio.\n\nEssa etapa inclui:\n\n• Emissão de ART/RRT\n• Organização da documentação técnica\n• Envio para aprovação do condomínio',
    '📄 Acompanhar documentação', true
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Acompanhar o status das aprovações', 1),
    (v_stage_id, 'bwild', 'Emitir ART/RRT', 1),
    (v_stage_id, 'bwild', 'Enviar documentação ao condomínio', 2),
    (v_stage_id, 'bwild', 'Acompanhar retornos', 3);

  -- Stage 6: Liberação da Obra
  INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description, cta_text, cta_visible)
  VALUES (
    p_project_id, 6, 'Liberação da Obra', 'check-circle', 'pending',
    E'Após a aprovação da documentação pelo condomínio, a obra é oficialmente liberada.\n\nA partir deste momento:\n\n• Compartilhamos o cronograma da obra\n• Iniciamos a execução\n• Você acompanha todas as atualizações pelo portal',
    '🚀 Ver cronograma da obra', true
  ) RETURNING id INTO v_stage_id;
  
  INSERT INTO journey_todos (stage_id, owner, text, sort_order) VALUES
    (v_stage_id, 'client', 'Acompanhar o cronograma', 1),
    (v_stage_id, 'bwild', 'Iniciar a obra', 1),
    (v_stage_id, 'bwild', 'Atualizar o portal com status e marcos', 2);
END;
$$;