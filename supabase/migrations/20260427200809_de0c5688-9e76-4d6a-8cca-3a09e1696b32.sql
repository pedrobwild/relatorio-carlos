-- =========================================================
-- Módulo de Estoque
-- =========================================================

-- 1) Catálogo de itens
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  category TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_items_name ON public.stock_items (lower(name));
CREATE INDEX idx_stock_items_category ON public.stock_items (category);

-- 2) Movimentações (entradas, saídas, ajustes)
-- location_type: 'estoque' (estoque central) | 'obra' (vinculado a um project_id)
-- movement_type: 'entrada' | 'saida' | 'ajuste'
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste')),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location_type TEXT NOT NULL CHECK (location_type IN ('estoque','obra')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_name TEXT,
  unit_cost NUMERIC(14,2),
  invoice_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_obra_requires_project CHECK (
    (location_type = 'estoque' AND project_id IS NULL)
    OR (location_type = 'obra' AND project_id IS NOT NULL)
  )
);

CREATE INDEX idx_stock_movements_item ON public.stock_movements (item_id);
CREATE INDEX idx_stock_movements_project ON public.stock_movements (project_id);
CREATE INDEX idx_stock_movements_date ON public.stock_movements (movement_date DESC);

-- 3) Saldo agregado (uma linha por item + local)
CREATE TABLE public.stock_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL CHECK (location_type IN ('estoque','obra')),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade: 1 saldo por item+estoque central; 1 saldo por item+obra
CREATE UNIQUE INDEX uniq_balance_estoque
  ON public.stock_balances (item_id)
  WHERE location_type = 'estoque' AND project_id IS NULL;

CREATE UNIQUE INDEX uniq_balance_obra
  ON public.stock_balances (item_id, project_id)
  WHERE location_type = 'obra' AND project_id IS NOT NULL;

CREATE INDEX idx_stock_balances_item ON public.stock_balances (item_id);
CREATE INDEX idx_stock_balances_project ON public.stock_balances (project_id);

-- =========================================================
-- Triggers de updated_at
-- =========================================================
CREATE TRIGGER trg_stock_items_updated_at
BEFORE UPDATE ON public.stock_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_stock_movements_updated_at
BEFORE UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Trigger: atualizar saldo automaticamente
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement_to_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC(14,3);
  v_old_delta NUMERIC(14,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := CASE NEW.movement_type
                 WHEN 'entrada' THEN NEW.quantity
                 WHEN 'saida'   THEN -NEW.quantity
                 WHEN 'ajuste'  THEN NEW.quantity
               END;

    INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
    VALUES (NEW.item_id, NEW.location_type, NEW.project_id, v_delta)
    ON CONFLICT ON CONSTRAINT uniq_balance_estoque
      DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                    updated_at = now();
    -- Para obra, tratamos via update separado quando location_type='obra'
    IF NEW.location_type = 'obra' THEN
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'obra', NEW.project_id, v_delta)
      ON CONFLICT ON CONSTRAINT uniq_balance_obra
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_delta := CASE OLD.movement_type
                     WHEN 'entrada' THEN OLD.quantity
                     WHEN 'saida'   THEN -OLD.quantity
                     WHEN 'ajuste'  THEN OLD.quantity
                   END;

    UPDATE public.stock_balances
    SET quantity = quantity - v_old_delta,
        updated_at = now()
    WHERE item_id = OLD.item_id
      AND location_type = OLD.location_type
      AND COALESCE(project_id::text,'') = COALESCE(OLD.project_id::text,'');

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter movimento antigo
    v_old_delta := CASE OLD.movement_type
                     WHEN 'entrada' THEN OLD.quantity
                     WHEN 'saida'   THEN -OLD.quantity
                     WHEN 'ajuste'  THEN OLD.quantity
                   END;

    UPDATE public.stock_balances
    SET quantity = quantity - v_old_delta,
        updated_at = now()
    WHERE item_id = OLD.item_id
      AND location_type = OLD.location_type
      AND COALESCE(project_id::text,'') = COALESCE(OLD.project_id::text,'');

    -- Aplicar movimento novo
    v_delta := CASE NEW.movement_type
                 WHEN 'entrada' THEN NEW.quantity
                 WHEN 'saida'   THEN -NEW.quantity
                 WHEN 'ajuste'  THEN NEW.quantity
               END;

    IF NEW.location_type = 'estoque' THEN
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'estoque', NULL, v_delta)
      ON CONFLICT ON CONSTRAINT uniq_balance_estoque
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    ELSE
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'obra', NEW.project_id, v_delta)
      ON CONFLICT ON CONSTRAINT uniq_balance_obra
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement_to_balance();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

-- Itens: staff pode tudo, exceto delete (apenas admin)
CREATE POLICY "Staff can view stock items"
ON public.stock_items FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert stock items"
ON public.stock_items FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update stock items"
ON public.stock_items FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete stock items"
ON public.stock_items FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Movimentações
CREATE POLICY "Staff can view stock movements"
ON public.stock_movements FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert stock movements"
ON public.stock_movements FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update stock movements"
ON public.stock_movements FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete stock movements"
ON public.stock_movements FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Saldos (somente leitura via app; escrita só pela trigger)
CREATE POLICY "Staff can view stock balances"
ON public.stock_balances FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));