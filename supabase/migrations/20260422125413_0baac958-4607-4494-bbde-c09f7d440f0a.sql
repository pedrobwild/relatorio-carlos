-- Enums fixos para os campos select
DO $$ BEGIN
  CREATE TYPE public.painel_etapa_enum AS ENUM (
    'Medição', 'Executivo', 'Emissão RRT', 'Condomínio', 'Planejamento', 'Mobilização'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.painel_status_enum AS ENUM ('Em dia', 'Atrasado', 'Paralisada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.painel_relacionamento_enum AS ENUM (
    'Normal', 'Atrito', 'Insatisfeito', 'Crítico'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.painel_obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  prazo text,
  inicio_oficial date,
  entrega_oficial date,
  etapa public.painel_etapa_enum,
  inicio_etapa date,
  previsao_avanco date,
  status public.painel_status_enum,
  inicio_real date,
  entrega_real date,
  relacionamento public.painel_relacionamento_enum,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultima_atualizacao timestamptz NOT NULL DEFAULT now()
);

-- Trigger: atualiza ultima_atualizacao em cada UPDATE
CREATE OR REPLACE FUNCTION public.set_painel_obras_ultima_atualizacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ultima_atualizacao = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_painel_obras_ultima_atualizacao ON public.painel_obras;
CREATE TRIGGER trg_painel_obras_ultima_atualizacao
  BEFORE UPDATE ON public.painel_obras
  FOR EACH ROW EXECUTE FUNCTION public.set_painel_obras_ultima_atualizacao();

-- Trigger: define created_by automaticamente
DROP TRIGGER IF EXISTS trg_painel_obras_set_created_by ON public.painel_obras;
CREATE TRIGGER trg_painel_obras_set_created_by
  BEFORE INSERT ON public.painel_obras
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- RLS: somente staff pode acessar; somente admin pode deletar
ALTER TABLE public.painel_obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff pode visualizar painel" ON public.painel_obras;
CREATE POLICY "Staff pode visualizar painel"
  ON public.painel_obras
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir no painel" ON public.painel_obras;
CREATE POLICY "Staff pode inserir no painel"
  ON public.painel_obras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar no painel" ON public.painel_obras;
CREATE POLICY "Staff pode atualizar no painel"
  ON public.painel_obras
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin pode deletar do painel" ON public.painel_obras;
CREATE POLICY "Admin pode deletar do painel"
  ON public.painel_obras
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));