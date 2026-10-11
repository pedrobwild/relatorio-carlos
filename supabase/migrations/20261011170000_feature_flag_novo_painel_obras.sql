-- Fase 5 da reformulação do processo core de obras.
-- Flag da tela Obras nova (/gestao/obras): quando ligada, o item "Obras" do
-- menu simples (gestor de obra) e a entrada /gestao passam a abrir a tela
-- nova, e o menu completo ganha o atalho "Obras" em "Meu trabalho".
-- O Painel de Obras antigo continua em /gestao/painel-obras ("Painel completo").
-- Começa desligada: liga-se no Supabase quando a obra piloto estiver pronta.
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'novoPainelObras',
  false,
  'Tela Obras nova (Fase 5): uma linha por obra ordenada por risco, com folga em dias úteis, semana e alerta. Substitui o Painel de Obras no menu simples.'
)
ON CONFLICT (key) DO NOTHING;
