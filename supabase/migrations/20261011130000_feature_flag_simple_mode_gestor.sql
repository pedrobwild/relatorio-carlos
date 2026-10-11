-- Fase 0 da reformulação do processo core de obras.
-- Flag global que liga o "modo simples" do menu de gestão: gestores de obra e
-- engenheiros (sem papel de escritório) veem só Obras / Semana / Hoje.
-- O usuário sempre pode alternar para o menu completo pelo próprio sidebar;
-- a flag define apenas o padrão. Nenhuma rota é removida.
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'simpleModeGestor',
  true,
  'Menu de gestão reduzido a Obras / Semana / Hoje para gestor e engineer (Fase 0 da reformulação). Usuário pode alternar para o menu completo.'
)
ON CONFLICT (key) DO NOTHING;
