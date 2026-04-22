-- =========================================================================
-- Painel de Obras — expansão dos enums e prazo como select controlado
-- =========================================================================
-- Contexto:
--   1. Adicionar novas etapas: Execução, Vistoria, Vistoria reprovada, Finalizada
--   2. Adicionar novo status "Aguardando" (será o default quando não houver valor)
--   3. Converter painel_prazo de texto livre para select com opções fixas
--      (55, 60, 65, 75 dias). Mantido como text para permanecer flexível
--      caso o negócio precise incluir novas faixas — a validação é feita no
--      front-end via constante PAINEL_PRAZO_OPTIONS.
--   4. Trigger: ao mudar painel_etapa, define painel_inicio_etapa = CURRENT_DATE
--      automaticamente (se o valor não for fornecido na mesma UPDATE).
-- =========================================================================

-- ------------------------------------------------------------------
-- 1) Adicionar novas labels ao enum de Etapa
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Execução'
      AND enumtypid = 'public.painel_etapa_enum'::regtype
  ) THEN
    ALTER TYPE public.painel_etapa_enum ADD VALUE 'Execução';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Vistoria'
      AND enumtypid = 'public.painel_etapa_enum'::regtype
  ) THEN
    ALTER TYPE public.painel_etapa_enum ADD VALUE 'Vistoria';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Vistoria reprovada'
      AND enumtypid = 'public.painel_etapa_enum'::regtype
  ) THEN
    ALTER TYPE public.painel_etapa_enum ADD VALUE 'Vistoria reprovada';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Finalizada'
      AND enumtypid = 'public.painel_etapa_enum'::regtype
  ) THEN
    ALTER TYPE public.painel_etapa_enum ADD VALUE 'Finalizada';
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 2) Adicionar novo status "Aguardando"
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Aguardando'
      AND enumtypid = 'public.painel_status_enum'::regtype
  ) THEN
    ALTER TYPE public.painel_status_enum ADD VALUE 'Aguardando' BEFORE 'Em dia';
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 3) Trigger: ao alterar painel_etapa, grava painel_inicio_etapa = hoje
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_painel_inicio_etapa_on_etapa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara se a etapa mudou E o caller não forneceu inicio_etapa
  -- explícito na mesma UPDATE (permite override manual).
  IF NEW.painel_etapa IS DISTINCT FROM OLD.painel_etapa
     AND NEW.painel_inicio_etapa IS NOT DISTINCT FROM OLD.painel_inicio_etapa
  THEN
    NEW.painel_inicio_etapa := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_painel_inicio_etapa ON public.projects;
CREATE TRIGGER trg_projects_painel_inicio_etapa
BEFORE UPDATE OF painel_etapa ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_painel_inicio_etapa_on_etapa_change();

-- ------------------------------------------------------------------
-- 4) (opcional) Comentários documentando o domínio
-- ------------------------------------------------------------------
COMMENT ON COLUMN public.projects.painel_prazo IS
  'Prazo da obra como label livre. Front-end restringe a 55, 60, 65 ou 75 dias (PAINEL_PRAZO_OPTIONS).';
COMMENT ON COLUMN public.projects.painel_inicio_etapa IS
  'Data de início da etapa atual. Preenchida automaticamente por trigger ao mudar painel_etapa.';
