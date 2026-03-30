
-- Create corrective action templates table
CREATE TABLE public.corrective_action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.corrective_action_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can read active templates
CREATE POLICY "Staff can read active templates"
  ON public.corrective_action_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

-- Only admin can insert/update/delete
CREATE POLICY "Admin can insert templates"
  ON public.corrective_action_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update templates"
  ON public.corrective_action_templates
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete templates"
  ON public.corrective_action_templates
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default templates
INSERT INTO public.corrective_action_templates (category, title, template_text) VALUES
  ('Hidráulica', 'Reparo de vazamento', 'Identificar e selar o ponto de vazamento. Testar pressão do ramal. Refazer vedação com material adequado.'),
  ('Elétrica', 'Reparo elétrico geral', 'Desligar circuito afetado. Verificar conexões e isolamento. Substituir componentes danificados. Testar com multímetro antes de religar.'),
  ('Revestimento', 'Reassentamento de peças', 'Remover peças soltas ou com som cavo. Limpar substrato. Aplicar argamassa adequada e reassentar. Rejuntar após cura.'),
  ('Pintura', 'Retrabalho de pintura', 'Lixar superfície irregular. Aplicar massa corrida onde necessário. Pintar com 2 demãos na cor especificada.'),
  ('Impermeabilização', 'Reparo de infiltração', 'Identificar área de infiltração. Remover revestimento na área afetada. Aplicar manta ou produto impermeabilizante conforme especificação. Testar com teste de estanqueidade.'),
  ('Estrutural', 'Avaliação estrutural', 'Acionar responsável técnico (engenheiro) para avaliação. Seguir laudo técnico para execução do reparo.'),
  ('Segurança do Trabalho', 'Correção de segurança', 'Paralisar atividade imediatamente. Providenciar EPI/EPC adequado. Retomar somente após comprovação de conformidade.'),
  ('Carpintaria', 'Ajuste de carpintaria', 'Verificar nivelamento e esquadro. Ajustar ferragens ou substituir componente danificado. Testar funcionamento.'),
  ('Planejamento', 'Realinhamento de planejamento', 'Alinhar com equipe técnica e cliente. Emitir RDO com justificativa. Revisar cronograma se necessário.'),
  ('Outros', 'Ação genérica', 'Descreva a ação corretiva detalhadamente.');
