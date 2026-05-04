
CREATE OR REPLACE FUNCTION public.apply_stock_movement_to_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    IF NEW.location_type = 'estoque' THEN
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'estoque', NULL, v_delta)
      ON CONFLICT (item_id) WHERE location_type = 'estoque' AND project_id IS NULL
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    ELSE
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'obra', NEW.project_id, v_delta)
      ON CONFLICT (item_id, project_id) WHERE location_type = 'obra' AND project_id IS NOT NULL
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

    v_delta := CASE NEW.movement_type
                 WHEN 'entrada' THEN NEW.quantity
                 WHEN 'saida'   THEN -NEW.quantity
                 WHEN 'ajuste'  THEN NEW.quantity
               END;

    IF NEW.location_type = 'estoque' THEN
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'estoque', NULL, v_delta)
      ON CONFLICT (item_id) WHERE location_type = 'estoque' AND project_id IS NULL
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    ELSE
      INSERT INTO public.stock_balances (item_id, location_type, project_id, quantity)
      VALUES (NEW.item_id, 'obra', NEW.project_id, v_delta)
      ON CONFLICT (item_id, project_id) WHERE location_type = 'obra' AND project_id IS NOT NULL
        DO UPDATE SET quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                      updated_at = now();
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;
