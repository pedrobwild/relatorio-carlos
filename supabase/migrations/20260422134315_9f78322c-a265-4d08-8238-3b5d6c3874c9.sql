-- Adicionar colunas do Painel de Obras na tabela projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS painel_etapa public.painel_etapa_enum,
  ADD COLUMN IF NOT EXISTS painel_status public.painel_status_enum,
  ADD COLUMN IF NOT EXISTS painel_relacionamento public.painel_relacionamento_enum,
  ADD COLUMN IF NOT EXISTS painel_prazo text,
  ADD COLUMN IF NOT EXISTS painel_inicio_etapa date,
  ADD COLUMN IF NOT EXISTS painel_previsao_avanco date,
  ADD COLUMN IF NOT EXISTS painel_ultima_atualizacao timestamptz NOT NULL DEFAULT now();

-- Trigger para atualizar painel_ultima_atualizacao quando qualquer campo do painel mudar
CREATE OR REPLACE FUNCTION public.update_painel_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.painel_etapa IS DISTINCT FROM OLD.painel_etapa OR
    NEW.painel_status IS DISTINCT FROM OLD.painel_status OR
    NEW.painel_relacionamento IS DISTINCT FROM OLD.painel_relacionamento OR
    NEW.painel_prazo IS DISTINCT FROM OLD.painel_prazo OR
    NEW.painel_inicio_etapa IS DISTINCT FROM OLD.painel_inicio_etapa OR
    NEW.painel_previsao_avanco IS DISTINCT FROM OLD.painel_previsao_avanco
  ) THEN
    NEW.painel_ultima_atualizacao := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_painel_timestamp ON public.projects;
CREATE TRIGGER trg_projects_painel_timestamp
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_painel_timestamp();

-- Migrar dados existentes da tabela painel_obras (matching por nome) e depois descartar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'painel_obras') THEN
    UPDATE public.projects p
    SET
      painel_etapa = po.etapa,
      painel_status = po.status,
      painel_relacionamento = po.relacionamento,
      painel_prazo = po.prazo,
      painel_inicio_etapa = po.inicio_etapa,
      painel_previsao_avanco = po.previsao_avanco
    FROM public.painel_obras po
    WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(po.nome));
    
    DROP TABLE public.painel_obras CASCADE;
  END IF;
END $$;