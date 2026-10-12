-- Painel de Obras reformulado em /gestao/painel-obras.
-- Ligada por padrão (o código também assume ligada quando a linha não
-- existe). Para voltar todo mundo ao painel antigo sem publicar:
--   UPDATE public.feature_flags SET enabled = false WHERE key = 'painelReformulado';
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'painelReformulado',
  true,
  'Painel de Obras reformulado em /gestao/painel-obras (3 números, um veredito por obra, ordem por risco). Desligada = painel antigo para todos.'
)
ON CONFLICT (key) DO NOTHING;
