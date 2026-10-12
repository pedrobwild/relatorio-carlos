-- =====================================================================
-- FICHA DA OBRA — o que faltava para a equipe entrar e trabalhar no prédio
-- =====================================================================
-- project_studio_info já guarda endereço, local das chaves, senha da
-- fechadura, síndico, gerente predial, dias/horários permitidos e as
-- instruções de acesso. Faltavam as respostas que o gestor procura no
-- celular, na porta do condomínio:
--
--   - quem da Bwild recebeu as chaves;
--   - o contato da portaria;
--   - o contato da administradora do condomínio;
--   - o passo a passo para pedir a liberação da nossa equipe (para quem
--     enviar, com quantos dias de antecedência, quais documentos).
--
-- Só colunas novas, todas opcionais. RLS não muda: continua valendo a
-- regra da tabela (somente staff com acesso à obra; cliente não vê).
-- Idempotente.
-- =====================================================================

ALTER TABLE public.project_studio_info
  ADD COLUMN IF NOT EXISTS keys_received_by      text,
  ADD COLUMN IF NOT EXISTS concierge_name        text,
  ADD COLUMN IF NOT EXISTS concierge_phone       text,
  ADD COLUMN IF NOT EXISTS property_admin_name   text,
  ADD COLUMN IF NOT EXISTS property_admin_phone  text,
  ADD COLUMN IF NOT EXISTS property_admin_email  text,
  ADD COLUMN IF NOT EXISTS access_release_process text;

COMMENT ON COLUMN public.project_studio_info.keys_received_by IS
  'Quem da Bwild recebeu as chaves do imóvel (nome).';
COMMENT ON COLUMN public.project_studio_info.concierge_name IS
  'Portaria do condomínio: nome do contato (ou "Portaria 24h").';
COMMENT ON COLUMN public.project_studio_info.concierge_phone IS
  'Portaria do condomínio: telefone.';
COMMENT ON COLUMN public.project_studio_info.property_admin_name IS
  'Administradora do condomínio: nome da empresa ou do contato.';
COMMENT ON COLUMN public.project_studio_info.property_admin_phone IS
  'Administradora do condomínio: telefone.';
COMMENT ON COLUMN public.project_studio_info.property_admin_email IS
  'Administradora do condomínio: e-mail.';
COMMENT ON COLUMN public.project_studio_info.access_release_process IS
  'Passo a passo para pedir a liberação da equipe no condomínio: para quem enviar, com quantos dias de antecedência e quais documentos. Texto simples, com quebras de linha.';
