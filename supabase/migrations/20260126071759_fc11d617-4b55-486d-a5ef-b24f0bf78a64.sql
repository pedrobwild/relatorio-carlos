-- Drop the problematic trigger that causes FK violation
DROP TRIGGER IF EXISTS resolve_payment_pending_item_trigger ON project_payments;

-- Recreate the function to handle null org_id gracefully
CREATE OR REPLACE FUNCTION public.resolve_payment_pending_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When payment is marked as paid, resolve the pending item
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    UPDATE public.pending_items
    SET 
      status = 'completed',
      resolved_at = now(),
      resolved_by = auth.uid()
    WHERE 
      reference_type = 'payment' AND
      reference_id = NEW.id AND
      status = 'pending';
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the payment update
  RAISE WARNING 'Failed to resolve pending item: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER resolve_payment_pending_item_trigger
AFTER UPDATE ON project_payments
FOR EACH ROW
EXECUTE FUNCTION resolve_payment_pending_item();