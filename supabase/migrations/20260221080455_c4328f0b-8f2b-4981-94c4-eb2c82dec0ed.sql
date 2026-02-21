
-- ============================================================
-- P0.1: Fix action_url in create_signature_pending_item (singular -> plural)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_signature_pending_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  IF OLD.status <> 'pending_signatures' AND NEW.status = 'pending_signatures' THEN
    v_project_id := NEW.project_id;
    INSERT INTO public.pending_items (
      project_id,
      customer_org_id,
      type,
      title,
      description,
      reference_type,
      reference_id,
      due_date,
      action_url
    ) VALUES (
      v_project_id,
      NEW.customer_org_id,
      'signature',
      'Assinatura pendente: ' || NEW.title,
      NEW.summary,
      'formalization',
      NEW.id,
      CURRENT_DATE + 5,
      '/obra/' || v_project_id || '/formalizacoes/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix existing bad URLs
UPDATE public.pending_items
SET action_url = replace(action_url, '/formalizacao/', '/formalizacoes/')
WHERE reference_type = 'formalization'
  AND action_url LIKE '%/formalizacao/%';

-- ============================================================
-- P0.2: Fix handle_formalization_lock to allow signed/voided after lock
-- Lock happens at pending_signatures, not at signed
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_formalization_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  -- When transitioning to pending_signatures, compute lock if not already set (fail-safe)
  IF NEW.status = 'pending_signatures' AND OLD.status IS DISTINCT FROM 'pending_signatures' THEN
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at = now();
    END IF;
    IF NEW.locked_hash IS NULL THEN
      NEW.locked_hash = public.compute_formalization_hash(NEW.id);
    END IF;
  END IF;

  -- If already locked, prevent content changes but allow status evolution
  IF OLD.locked_at IS NOT NULL THEN
    -- Block content modifications
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.body_md IS DISTINCT FROM OLD.body_md
       OR NEW.data IS DISTINCT FROM OLD.data
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
      RAISE EXCEPTION 'Cannot modify locked formalization content';
    END IF;

    -- Only allow status to evolve to signed or voided
    IF NEW.status IS DISTINCT FROM OLD.status 
       AND NEW.status NOT IN ('signed', 'voided') THEN
      RAISE EXCEPTION 'Locked formalization status can only change to signed or voided';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop ALL duplicate triggers on formalizations and keep only one of each
DROP TRIGGER IF EXISTS handle_formalization_lock_trigger ON public.formalizations;
DROP TRIGGER IF EXISTS trg_handle_formalization_lock ON public.formalizations;
CREATE TRIGGER trg_handle_formalization_lock
  BEFORE UPDATE ON public.formalizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_formalization_lock();

DROP TRIGGER IF EXISTS on_formalization_sent_for_signature ON public.formalizations;
DROP TRIGGER IF EXISTS trg_create_signature_pending_item ON public.formalizations;
CREATE TRIGGER trg_create_signature_pending_item
  AFTER UPDATE ON public.formalizations
  FOR EACH ROW EXECUTE FUNCTION public.create_signature_pending_item();

DROP TRIGGER IF EXISTS on_formalization_signed ON public.formalizations;
DROP TRIGGER IF EXISTS trg_resolve_signature_pending_item ON public.formalizations;
CREATE TRIGGER trg_resolve_signature_pending_item
  AFTER UPDATE ON public.formalizations
  FOR EACH ROW EXECUTE FUNCTION public.resolve_signature_pending_item();

DROP TRIGGER IF EXISTS update_formalizations_updated_at ON public.formalizations;
DROP TRIGGER IF EXISTS trg_update_formalization_updated_at ON public.formalizations;
CREATE TRIGGER trg_update_formalization_updated_at
  BEFORE UPDATE ON public.formalizations
  FOR EACH ROW EXECUTE FUNCTION public.update_formalization_updated_at();

-- ============================================================
-- P0.3: Auto-finalize formalization when all required parties have signed
-- ============================================================
CREATE OR REPLACE FUNCTION public.maybe_mark_formalization_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_formalization_id UUID;
  v_total_required INTEGER;
  v_total_signed INTEGER;
  v_current_status TEXT;
BEGIN
  -- Get the formalization_id from the party
  SELECT fp.formalization_id INTO v_formalization_id
  FROM public.formalization_parties fp
  WHERE fp.id = NEW.party_id;

  IF v_formalization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check current status
  SELECT status::text INTO v_current_status
  FROM public.formalizations
  WHERE id = v_formalization_id;

  -- Only auto-complete if currently pending_signatures
  IF v_current_status <> 'pending_signatures' THEN
    RETURN NEW;
  END IF;

  -- Count required parties
  SELECT COUNT(*) INTO v_total_required
  FROM public.formalization_parties
  WHERE formalization_id = v_formalization_id AND must_sign = true;

  -- Count signed parties
  SELECT COUNT(DISTINCT fp.id) INTO v_total_signed
  FROM public.formalization_parties fp
  INNER JOIN public.formalization_acknowledgements fa ON fa.party_id = fp.id
  WHERE fp.formalization_id = v_formalization_id AND fp.must_sign = true;

  -- If all required parties have signed, mark as signed
  IF v_total_required > 0 AND v_total_signed >= v_total_required THEN
    UPDATE public.formalizations
    SET status = 'signed'
    WHERE id = v_formalization_id
      AND status = 'pending_signatures';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maybe_mark_formalization_signed ON public.formalization_acknowledgements;
CREATE TRIGGER trg_maybe_mark_formalization_signed
  AFTER INSERT ON public.formalization_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.maybe_mark_formalization_signed();

-- ============================================================
-- P0.4 (RLS): Helper function for signature visibility
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_must_sign_formalization(p_user_id uuid, p_formalization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.formalization_parties fp
    WHERE fp.formalization_id = p_formalization_id
      AND fp.must_sign = true
      AND (
        fp.user_id = p_user_id
        OR fp.email = (SELECT email FROM public.profiles WHERE user_id = p_user_id LIMIT 1)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.formalization_acknowledgements fa
        WHERE fa.party_id = fp.id
      )
  )
$$;

-- Drop and recreate pending_items select policy
DROP POLICY IF EXISTS pending_items_select_policy ON public.pending_items;
CREATE POLICY pending_items_select_policy ON public.pending_items
  FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), customer_org_id)
    AND (
      -- Staff sees everything in their org
      user_is_staff_or_above(auth.uid())
      -- Non-signature items: org members see them
      OR type <> 'signature'
      -- Signature items: only if user must sign
      OR (type = 'signature' AND reference_type = 'formalization' AND user_must_sign_formalization(auth.uid(), reference_id))
    )
  );

-- Drop and recreate pending_items update policy  
DROP POLICY IF EXISTS pending_items_update_policy ON public.pending_items;
CREATE POLICY pending_items_update_policy ON public.pending_items
  FOR UPDATE
  USING (
    user_belongs_to_org(auth.uid(), customer_org_id)
    AND (
      user_is_staff_or_above(auth.uid())
      OR (status = 'pending' AND type <> 'signature')
      OR (type = 'signature' AND reference_type = 'formalization' AND user_must_sign_formalization(auth.uid(), reference_id))
    )
  );
