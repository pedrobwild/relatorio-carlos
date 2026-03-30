CREATE TABLE public.inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view templates"
  ON public.inspection_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

INSERT INTO public.inspection_templates (category, description, sort_order) VALUES
  ('Alvenaria', 'Prumo das paredes verificado', 1),
  ('Alvenaria', 'Esquadro das quinas conferido', 2),
  ('Alvenaria', 'Nivelamento correto', 3),
  ('Alvenaria', 'Argamassa uniforme', 4),
  ('Alvenaria', 'Ausência de trincas ou fissuras', 5),
  ('Elétrica', 'Pontos de tomada conforme projeto', 1),
  ('Elétrica', 'Fiação identificada e organizada', 2),
  ('Elétrica', 'Disjuntores dimensionados', 3),
  ('Elétrica', 'Aterramento verificado', 4),
  ('Elétrica', 'Conduítes sem obstrução', 5),
  ('Hidráulica', 'Pontos de água conforme projeto', 1),
  ('Hidráulica', 'Teste de pressão realizado', 2),
  ('Hidráulica', 'Esgoto com caimento adequado', 3),
  ('Hidráulica', 'Ausência de vazamentos', 4),
  ('Hidráulica', 'Registros funcionando', 5),
  ('Acabamento', 'Revestimento cerâmico nivelado', 1),
  ('Acabamento', 'Pintura uniforme sem falhas', 2),
  ('Acabamento', 'Rejunte completo e limpo', 3),
  ('Acabamento', 'Soleiras e peitoris instalados', 4),
  ('Acabamento', 'Rodapés alinhados', 5),
  ('Estrutural', 'Armadura conforme projeto', 1),
  ('Estrutural', 'Formas alinhadas e niveladas', 2),
  ('Estrutural', 'Escoramento adequado', 3),
  ('Estrutural', 'Concreto sem segregação', 4),
  ('Estrutural', 'Cobrimento mínimo respeitado', 5);