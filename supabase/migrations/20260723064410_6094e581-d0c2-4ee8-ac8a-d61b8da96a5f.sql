-- =========================================================
-- Onda D2 — NC post-close verification + Punch list
-- ADITIVO: nenhum status, trigger ou coluna existente alterado.
-- =========================================================

-- 1) Verificação pós-fechamento em non_conformities (aditivo)
ALTER TABLE public.non_conformities
  ADD COLUMN IF NOT EXISTS post_close_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_close_verified_by uuid;

COMMENT ON COLUMN public.non_conformities.post_close_verified_at IS
  'Timestamp de verificação técnica opcional feita após o encerramento (D2). Independente do fluxo de status existente.';
COMMENT ON COLUMN public.non_conformities.post_close_verified_by IS
  'Usuário técnico que marcou a NC já encerrada como verificada em campo. Não altera status.';

-- 2) Punch list de entrega (aditivo)
CREATE TABLE IF NOT EXISTS public.punch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ambiente text NOT NULL,
  descricao text NOT NULL,
  responsible_user_id uuid,
  due_date date,
  photo_path text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'resolvido', 'verificado')),
  resolved_at timestamptz,
  resolved_by uuid,
  verified_at timestamptz,
  verified_by uuid,
  created_by uuid NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_items_project
  ON public.punch_items(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_punch_items_responsible
  ON public.punch_items(responsible_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_punch_items_status
  ON public.punch_items(project_id, status) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.punch_items TO authenticated;
GRANT ALL ON public.punch_items TO service_role;

ALTER TABLE public.punch_items ENABLE ROW LEVEL SECURITY;

-- Apenas staff (is_staff) enxerga/gerencia. Cliente NÃO vê.
CREATE POLICY "Staff pode ler punch items"
  ON public.punch_items FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Staff pode criar punch items"
  ON public.punch_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff pode atualizar punch items"
  ON public.punch_items FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode remover punch items"
  ON public.punch_items FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Trigger de updated_at (reaproveita função existente)
DROP TRIGGER IF EXISTS update_punch_items_updated_at ON public.punch_items;
CREATE TRIGGER update_punch_items_updated_at
  BEFORE UPDATE ON public.punch_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();