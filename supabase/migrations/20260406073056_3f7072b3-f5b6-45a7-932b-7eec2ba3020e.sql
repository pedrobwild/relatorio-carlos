
-- 1. Add orcamento_item_id to project_purchases for traceability
ALTER TABLE public.project_purchases
ADD COLUMN IF NOT EXISTS orcamento_item_id uuid REFERENCES public.orcamento_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_purchases_orcamento_item_id
ON public.project_purchases (orcamento_item_id)
WHERE orcamento_item_id IS NOT NULL;

-- Unique constraint: one purchase per budget item
ALTER TABLE public.project_purchases
ADD CONSTRAINT uq_purchase_orcamento_item UNIQUE (orcamento_item_id);

-- 2. Function to sync all budget "Produto" items to purchases for a given project
CREATE OR REPLACE FUNCTION public.sync_budget_items_to_purchases(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_admin_id uuid;
  v_default_date date := (CURRENT_DATE + interval '30 days')::date;
BEGIN
  -- Find an admin user for created_by
  SELECT id INTO v_admin_id
  FROM public.users_profile
  WHERE perfil = 'admin' AND status = 'ativo'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No active admin found for created_by';
  END IF;

  INSERT INTO public.project_purchases (
    project_id,
    orcamento_item_id,
    item_name,
    description,
    quantity,
    unit,
    estimated_cost,
    category,
    supplier_name,
    fornecedor_id,
    lead_time_days,
    required_by_date,
    status,
    purchase_type,
    created_by
  )
  SELECT
    p_project_id,
    oi.id,
    oi.title,
    oi.description,
    COALESCE(oi.qty, 1),
    COALESCE(oi.unit, 'un'),
    oi.internal_unit_price * COALESCE(oi.qty, 1),  -- total cost without BDI
    oi.item_category,
    oi.supplier_name,
    oi.supplier_id::uuid,
    7,
    v_default_date,
    'pending',
    'produto',
    v_admin_id
  FROM public.orcamento_items oi
  JOIN public.orcamento_sections os ON os.id = oi.section_id
  JOIN public.orcamentos o ON o.id = os.orcamento_id
  WHERE o.project_id = p_project_id
    AND oi.item_category = 'Produto'
    AND NOT EXISTS (
      SELECT 1 FROM public.project_purchases pp
      WHERE pp.orcamento_item_id = oi.id
    )
  ON CONFLICT (orcamento_item_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 3. Trigger: when a new orcamento_item with category Produto is inserted, auto-create purchase
CREATE OR REPLACE FUNCTION public.auto_create_purchase_from_budget_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_admin_id uuid;
  v_default_date date := (CURRENT_DATE + interval '30 days')::date;
  v_supplier_uuid uuid;
BEGIN
  -- Only for Produto items
  IF NEW.item_category IS DISTINCT FROM 'Produto' THEN
    RETURN NEW;
  END IF;

  -- Get project_id via section -> orcamento
  SELECT o.project_id INTO v_project_id
  FROM public.orcamento_sections os
  JOIN public.orcamentos o ON o.id = os.orcamento_id
  WHERE os.id = NEW.section_id;

  IF v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find admin for created_by
  SELECT id INTO v_admin_id
  FROM public.users_profile
  WHERE perfil = 'admin' AND status = 'ativo'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Safely cast supplier_id
  BEGIN
    v_supplier_uuid := NEW.supplier_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_supplier_uuid := NULL;
  END;

  INSERT INTO public.project_purchases (
    project_id,
    orcamento_item_id,
    item_name,
    description,
    quantity,
    unit,
    estimated_cost,
    category,
    supplier_name,
    fornecedor_id,
    lead_time_days,
    required_by_date,
    status,
    purchase_type,
    created_by
  )
  VALUES (
    v_project_id,
    NEW.id,
    NEW.title,
    NEW.description,
    COALESCE(NEW.qty, 1),
    COALESCE(NEW.unit, 'un'),
    NEW.internal_unit_price * COALESCE(NEW.qty, 1),
    NEW.item_category,
    NEW.supplier_name,
    v_supplier_uuid,
    7,
    v_default_date,
    'pending',
    'produto',
    v_admin_id
  )
  ON CONFLICT (orcamento_item_id) DO UPDATE SET
    item_name = EXCLUDED.item_name,
    description = EXCLUDED.description,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    estimated_cost = EXCLUDED.estimated_cost,
    supplier_name = EXCLUDED.supplier_name,
    fornecedor_id = EXCLUDED.fornecedor_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_create_purchase_from_budget_item] Failed for item %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_purchase_from_budget
AFTER INSERT ON public.orcamento_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_purchase_from_budget_item();

-- Also handle updates to item_category (e.g. changed to Produto after insert)
CREATE TRIGGER trg_auto_purchase_from_budget_update
AFTER UPDATE OF item_category ON public.orcamento_items
FOR EACH ROW
WHEN (NEW.item_category = 'Produto')
EXECUTE FUNCTION public.auto_create_purchase_from_budget_item();
