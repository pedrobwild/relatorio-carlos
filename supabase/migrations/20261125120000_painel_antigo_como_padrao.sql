-- O time prefere o Painel de Obras antigo como tela inicial.
-- Desliga o painel reformulado (/gestao/painel-obras volta ao antigo para
-- todos) e a tela Obras nova (/gestao deixa de redirecionar para ela).
-- Para reverter: UPDATE ... SET enabled = true nas duas chaves.
UPDATE public.feature_flags
   SET enabled = false, updated_at = now()
 WHERE key IN ('painelReformulado', 'novoPainelObras');
