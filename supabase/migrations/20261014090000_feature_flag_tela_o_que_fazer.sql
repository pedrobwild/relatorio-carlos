-- Tela "O que fazer" como entrada da gestão (/gestao) e 1º item do menu.
-- Ligada por padrão (o código também assume ligada quando a linha não
-- existe). Para voltar a entrada ao Painel de Obras sem publicar:
--   UPDATE public.feature_flags SET enabled = false WHERE key = 'telaOQueFazer';
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'telaOQueFazer',
  true,
  'Tela "O que fazer" (pendências das obras da pessoa, da mais grave para a mais leve) como entrada da gestão e 1º item do menu. Desligada = entrada volta ao Painel de Obras.'
)
ON CONFLICT (key) DO NOTHING;
