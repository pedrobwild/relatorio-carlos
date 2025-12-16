-- Create formalization_versions table to track content history
CREATE TABLE public.formalization_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  summary text NOT NULL,
  body_md text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(formalization_id, version_number)
);

-- Enable RLS
ALTER TABLE public.formalization_versions ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_formalization_versions_formalization ON public.formalization_versions(formalization_id, version_number DESC);

-- RLS policies - same access as parent formalization
CREATE POLICY "formalization_versions_select_policy" ON public.formalization_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.formalizations f
    WHERE f.id = formalization_versions.formalization_id
    AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
  )
);

-- No direct inserts/updates/deletes - managed by trigger
CREATE POLICY "formalization_versions_no_insert" ON public.formalization_versions
FOR INSERT WITH CHECK (false);

CREATE POLICY "formalization_versions_no_update" ON public.formalization_versions
FOR UPDATE USING (false);

CREATE POLICY "formalization_versions_no_delete" ON public.formalization_versions
FOR DELETE USING (public.user_is_admin(auth.uid()));

-- Function to save version before content changes
CREATE OR REPLACE FUNCTION public.save_formalization_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_number integer;
BEGIN
  -- Only save version if content fields changed and not locked
  IF OLD.locked_at IS NULL AND (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.summary IS DISTINCT FROM NEW.summary OR
    OLD.body_md IS DISTINCT FROM NEW.body_md OR
    OLD.data IS DISTINCT FROM NEW.data
  ) THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM public.formalization_versions
    WHERE formalization_id = OLD.id;
    
    -- Save the OLD content as a version
    INSERT INTO public.formalization_versions (
      formalization_id, version_number, title, summary, body_md, data, created_by
    ) VALUES (
      OLD.id, v_version_number, OLD.title, OLD.summary, OLD.body_md, OLD.data, COALESCE(auth.uid(), OLD.created_by)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach version trigger
CREATE TRIGGER trg_save_formalization_version
BEFORE UPDATE ON public.formalizations
FOR EACH ROW EXECUTE FUNCTION public.save_formalization_version();

-- Attach the existing lock trigger (ensuring it runs after version save)
DROP TRIGGER IF EXISTS trg_handle_formalization_lock ON public.formalizations;
CREATE TRIGGER trg_handle_formalization_lock
BEFORE UPDATE ON public.formalizations
FOR EACH ROW EXECUTE FUNCTION public.handle_formalization_lock();

-- Attach existing triggers for timestamps and last_activity
DROP TRIGGER IF EXISTS trg_update_formalization_updated_at ON public.formalizations;
CREATE TRIGGER trg_update_formalization_updated_at
BEFORE UPDATE ON public.formalizations
FOR EACH ROW EXECUTE FUNCTION public.update_formalization_updated_at();

-- Attach triggers for related tables to update last_activity
DROP TRIGGER IF EXISTS trg_update_last_activity_on_party ON public.formalization_parties;
CREATE TRIGGER trg_update_last_activity_on_party
AFTER INSERT ON public.formalization_parties
FOR EACH ROW EXECUTE FUNCTION public.update_formalization_last_activity();

DROP TRIGGER IF EXISTS trg_update_last_activity_on_ack ON public.formalization_acknowledgements;
CREATE TRIGGER trg_update_last_activity_on_ack
AFTER INSERT ON public.formalization_acknowledgements
FOR EACH ROW EXECUTE FUNCTION public.update_formalization_last_activity();

DROP TRIGGER IF EXISTS trg_update_last_activity_on_evidence ON public.formalization_evidence_links;
CREATE TRIGGER trg_update_last_activity_on_evidence
AFTER INSERT ON public.formalization_evidence_links
FOR EACH ROW EXECUTE FUNCTION public.update_formalization_last_activity();

DROP TRIGGER IF EXISTS trg_update_last_activity_on_attachment ON public.formalization_attachments;
CREATE TRIGGER trg_update_last_activity_on_attachment
AFTER INSERT ON public.formalization_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_formalization_last_activity();

-- Attach pending item triggers
DROP TRIGGER IF EXISTS trg_create_signature_pending_item ON public.formalizations;
CREATE TRIGGER trg_create_signature_pending_item
AFTER UPDATE ON public.formalizations
FOR EACH ROW EXECUTE FUNCTION public.create_signature_pending_item();

DROP TRIGGER IF EXISTS trg_resolve_signature_pending_item ON public.formalizations;
CREATE TRIGGER trg_resolve_signature_pending_item
AFTER UPDATE ON public.formalizations
FOR EACH ROW EXECUTE FUNCTION public.resolve_signature_pending_item();

DROP TRIGGER IF EXISTS trg_create_payment_pending_item ON public.project_payments;
CREATE TRIGGER trg_create_payment_pending_item
AFTER INSERT ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public.create_payment_pending_item();

DROP TRIGGER IF EXISTS trg_resolve_payment_pending_item ON public.project_payments;
CREATE TRIGGER trg_resolve_payment_pending_item
AFTER UPDATE ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public.resolve_payment_pending_item();