-- =====================================================================
-- Módulo de Controle de Estoque (Inventário de Obra)
-- Tabelas: stock_items, stock_movements
-- View: stock_items_with_balance (saldo calculado por item)
-- =====================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM (
    'entrada',     -- compra/recebimento (positivo)
    'saida',       -- consumo na obra (negativo)
    'perda',       -- quebra/perda (negativo)
    'sobra',       -- sobra/devolução ao estoque (positivo)
    'ajuste'       -- ajuste de inventário (pode ser + ou -)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_category AS ENUM (
    'revestimento',
    'hidraulica',
    'eletrica',
    'pintura',
    'estrutural',
    'esquadrias',
    'louca_metal',
    'iluminacao',
    'ferragens',
    'consumiveis',
    'outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 1) stock_items: cadastro de materiais por obra
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text,                           -- código interno (ex.: REV-001)
  name text NOT NULL,                  -- ex.: "Porcelanato 90x90"
  description text,
  category public.stock_category NOT NULL DEFAULT 'outros',
  unit text NOT NULL DEFAULT 'un',     -- m², un, lata, kg, m, etc.
  minimum_stock numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2),             -- custo unitário de referência
  default_location text,               -- "Depósito", "Obra/Banheiro", etc.
  supplier_name text,
  supplier_contact text,
  lead_time_days int NOT NULL DEFAULT 0,
  fornecedor_id uuid,                  -- ref opcional a fornecedores existentes
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_items_code_per_project UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stock_items_project ON public.stock_items(project_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_archived ON public.stock_items(is_archived);

DROP TRIGGER IF EXISTS trg_stock_items_updated_at ON public.stock_items;
CREATE TRIGGER trg_stock_items_updated_at
  BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2) stock_movements: entradas, saídas, perdas, sobras e ajustes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  movement_type public.stock_movement_type NOT NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0), -- sempre positiva; o sinal é dado pelo tipo
  signed_quantity numeric(14,3) GENERATED ALWAYS AS (
    CASE movement_type
      WHEN 'entrada' THEN quantity
      WHEN 'sobra'   THEN quantity
      WHEN 'saida'   THEN -quantity
      WHEN 'perda'   THEN -quantity
      WHEN 'ajuste'  THEN quantity   -- ajuste positivo por padrão; use ajuste com tipo separado se precisar negativo
    END
  ) STORED,
  unit_cost numeric(14,2),             -- custo unit. snapshot (opcional)
  ambient text,                        -- "Banheiro", "Cozinha", etc.
  responsible text,                    -- responsável pela movimentação
  document_ref text,                   -- "NF 123", "RDO 05", etc.
  cause text,                          -- causa da perda/sobra
  preventive_action text,              -- ação preventiva
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_project ON public.stock_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item ON public.stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_mov_date ON public.stock_movements(movement_date DESC);

DROP TRIGGER IF EXISTS trg_stock_movements_updated_at ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_updated_at
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garante que o item pertence ao mesmo projeto da movimentação
CREATE OR REPLACE FUNCTION public.stock_movements_check_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_project uuid;
BEGIN
  SELECT project_id INTO v_item_project FROM public.stock_items WHERE id = NEW.stock_item_id;
  IF v_item_project IS NULL THEN
    RAISE EXCEPTION 'Item de estoque não encontrado';
  END IF;
  IF v_item_project <> NEW.project_id THEN
    RAISE EXCEPTION 'O item pertence a outra obra';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_mov_check_project ON public.stock_movements;
CREATE TRIGGER trg_stock_mov_check_project
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_check_project();

-- =====================================================================
-- 3) View: saldo atual + status (OK / Comprar)
-- =====================================================================
CREATE OR REPLACE VIEW public.stock_items_with_balance AS
SELECT
  i.id,
  i.project_id,
  i.code,
  i.name,
  i.description,
  i.category,
  i.unit,
  i.minimum_stock,
  i.unit_cost,
  i.default_location,
  i.supplier_name,
  i.supplier_contact,
  i.lead_time_days,
  i.fornecedor_id,
  i.notes,
  i.is_archived,
  i.created_at,
  i.updated_at,
  COALESCE(SUM(m.signed_quantity), 0)::numeric(14,3) AS current_stock,
  COALESCE(SUM(CASE WHEN m.movement_type = 'entrada' THEN m.quantity ELSE 0 END), 0)::numeric(14,3) AS total_in,
  COALESCE(SUM(CASE WHEN m.movement_type = 'saida'   THEN m.quantity ELSE 0 END), 0)::numeric(14,3) AS total_out,
  COALESCE(SUM(CASE WHEN m.movement_type = 'perda'   THEN m.quantity ELSE 0 END), 0)::numeric(14,3) AS total_loss,
  COALESCE(SUM(CASE WHEN m.movement_type = 'sobra'   THEN m.quantity ELSE 0 END), 0)::numeric(14,3) AS total_surplus,
  CASE
    WHEN COALESCE(SUM(m.signed_quantity), 0) <= 0 THEN 'sem_estoque'
    WHEN COALESCE(SUM(m.signed_quantity), 0) <= i.minimum_stock THEN 'comprar'
    ELSE 'ok'
  END AS status,
  (COALESCE(SUM(m.signed_quantity), 0) * COALESCE(i.unit_cost, 0))::numeric(14,2) AS stock_value,
  (COALESCE(SUM(CASE WHEN m.movement_type = 'perda' THEN m.quantity ELSE 0 END), 0) * COALESCE(i.unit_cost, 0))::numeric(14,2) AS loss_value
FROM public.stock_items i
LEFT JOIN public.stock_movements m ON m.stock_item_id = i.id
GROUP BY i.id;

-- =====================================================================
-- 4) RLS — segue o padrão de "compras" (StaffRoute) mas permite leitura
--    para qualquer usuário com acesso ao projeto.
-- =====================================================================
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- stock_items
DROP POLICY IF EXISTS "Stock items: read with project access" ON public.stock_items;
CREATE POLICY "Stock items: read with project access"
  ON public.stock_items
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Stock items: staff insert" ON public.stock_items;
CREATE POLICY "Stock items: staff insert"
  ON public.stock_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), project_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Stock items: staff update" ON public.stock_items;
CREATE POLICY "Stock items: staff update"
  ON public.stock_items
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Stock items: staff delete" ON public.stock_items;
CREATE POLICY "Stock items: staff delete"
  ON public.stock_items
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- stock_movements
DROP POLICY IF EXISTS "Stock movements: read with project access" ON public.stock_movements;
CREATE POLICY "Stock movements: read with project access"
  ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Stock movements: staff insert" ON public.stock_movements;
CREATE POLICY "Stock movements: staff insert"
  ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), project_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Stock movements: staff update" ON public.stock_movements;
CREATE POLICY "Stock movements: staff update"
  ON public.stock_movements
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Stock movements: staff delete" ON public.stock_movements;
CREATE POLICY "Stock movements: staff delete"
  ON public.stock_movements
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- A view herda RLS das tabelas-base (desde que owner não bypass).
-- Garante grants:
GRANT SELECT ON public.stock_items_with_balance TO authenticated;
GRANT ALL ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_movements TO authenticated;

COMMENT ON TABLE  public.stock_items     IS 'Cadastro de materiais por obra (controle de estoque).';
COMMENT ON TABLE  public.stock_movements IS 'Movimentações de estoque: entradas, saídas, perdas, sobras e ajustes.';
COMMENT ON VIEW   public.stock_items_with_balance IS 'Saldo atual e status calculados por item.';
