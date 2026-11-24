-- Diário de obra: a equipe só LÊ as tabelas; gravar é só pelas funções.
-- Tira as permissões que o Supabase concede por padrão a toda tabela nova
-- (TRUNCATE, REFERENCES, TRIGGER). Não altera dados nem as regras de leitura.
REVOKE ALL ON public.diario_obra FROM anon, authenticated;
REVOKE ALL ON public.diario_obra_etapas FROM anon, authenticated;
REVOKE ALL ON public.diario_obra_pendencias FROM anon, authenticated;
REVOKE ALL ON public.diario_obra_materiais FROM anon, authenticated;
GRANT SELECT ON public.diario_obra TO authenticated;
GRANT SELECT ON public.diario_obra_etapas TO authenticated;
GRANT SELECT ON public.diario_obra_pendencias TO authenticated;
GRANT SELECT ON public.diario_obra_materiais TO authenticated;
