
-- Add milestone date columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS date_briefing_arch date,
  ADD COLUMN IF NOT EXISTS date_approval_3d date,
  ADD COLUMN IF NOT EXISTS date_approval_exec date,
  ADD COLUMN IF NOT EXISTS date_approval_obra date,
  ADD COLUMN IF NOT EXISTS date_official_start date,
  ADD COLUMN IF NOT EXISTS date_official_delivery date;

COMMENT ON COLUMN public.projects.date_briefing_arch IS 'Data do Briefing de Arquitetura';
COMMENT ON COLUMN public.projects.date_approval_3d IS 'Data de Aprovação do Projeto 3D';
COMMENT ON COLUMN public.projects.date_approval_exec IS 'Data de Aprovação do Projeto Executivo';
COMMENT ON COLUMN public.projects.date_approval_obra IS 'Data de Aprovação da Obra';
COMMENT ON COLUMN public.projects.date_official_start IS 'Data de Início Oficial';
COMMENT ON COLUMN public.projects.date_official_delivery IS 'Data de Entrega Oficial';
