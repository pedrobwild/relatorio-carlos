-- Enable pgcrypto for hash functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum for formalization types
CREATE TYPE formalization_type AS ENUM ('budget_item_swap', 'meeting_minutes', 'exception_custody', 'scope_change', 'general');

-- Create enum for formalization status
CREATE TYPE formalization_status AS ENUM ('draft', 'pending_signatures', 'signed', 'voided');

-- Create enum for party type
CREATE TYPE party_type AS ENUM ('customer', 'company');

-- Create enum for evidence link kind
CREATE TYPE evidence_link_kind AS ENUM ('meeting_recording', 'drive_link', 'external_doc', 'other');

-- Create enum for formalization event type
CREATE TYPE formalization_event_type AS ENUM ('created', 'updated', 'sent_for_signature', 'signed_by_party', 'locked', 'voided', 'evidence_added', 'attachment_added');

-- A) formalizations table
CREATE TABLE public.formalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_org_id uuid NOT NULL,
  project_id uuid NULL,
  unit_id uuid NULL,
  type formalization_type NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body_md text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status formalization_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  locked_at timestamptz NULL,
  locked_hash text NULL,
  prev_hash text NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- B) formalization_parties table
CREATE TABLE public.formalization_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  party_type party_type NOT NULL,
  display_name text NOT NULL,
  user_id uuid NULL,
  email text NULL,
  role_label text NULL,
  must_sign boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- C) formalization_acknowledgements table
CREATE TABLE public.formalization_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.formalization_parties(id) ON DELETE CASCADE,
  acknowledged boolean NOT NULL DEFAULT true,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by_user_id uuid NULL,
  acknowledged_by_email text NULL,
  ip_address text NULL,
  user_agent text NULL,
  signature_text text NULL,
  signature_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formalization_id, party_id)
);

-- D) formalization_evidence_links table
CREATE TABLE public.formalization_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  kind evidence_link_kind NOT NULL,
  url text NOT NULL,
  description text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- E) formalization_attachments table
CREATE TABLE public.formalization_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'formalization-attachments',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- F) formalization_events table (audit trail)
CREATE TABLE public.formalization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formalization_id uuid NOT NULL REFERENCES public.formalizations(id) ON DELETE CASCADE,
  event_type formalization_event_type NOT NULL,
  actor_user_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('formalization-attachments', 'formalization-attachments', false);

-- Function to compute formalization hash
CREATE OR REPLACE FUNCTION public.compute_formalization_hash(p_formalization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_json jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'customer_org_id', customer_org_id,
    'project_id', project_id,
    'unit_id', unit_id,
    'type', type,
    'title', title,
    'summary', summary,
    'body_md', body_md,
    'data', data,
    'created_at', created_at
  ) INTO v_json
  FROM public.formalizations
  WHERE id = p_formalization_id;
  
  IF v_json IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_hash := encode(digest(v_json::text, 'sha256'), 'hex');
  RETURN v_hash;
END;
$$;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_formalization_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at on formalizations
CREATE TRIGGER update_formalizations_updated_at
  BEFORE UPDATE ON public.formalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_formalization_updated_at();

-- Trigger function to update last_activity_at on formalizations
CREATE OR REPLACE FUNCTION public.update_formalization_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.formalizations 
  SET last_activity_at = now() 
  WHERE id = NEW.formalization_id;
  RETURN NEW;
END;
$$;

-- Triggers for last_activity_at
CREATE TRIGGER update_formalization_activity_on_event
  AFTER INSERT ON public.formalization_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_formalization_last_activity();

CREATE TRIGGER update_formalization_activity_on_link
  AFTER INSERT ON public.formalization_evidence_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_formalization_last_activity();

CREATE TRIGGER update_formalization_activity_on_attachment
  AFTER INSERT ON public.formalization_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_formalization_last_activity();

-- Trigger function to handle lock rules
CREATE OR REPLACE FUNCTION public.handle_formalization_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When status changes to 'signed', lock the formalization
  IF OLD.status != 'signed' AND NEW.status = 'signed' THEN
    NEW.locked_at = now();
    NEW.locked_hash = public.compute_formalization_hash(NEW.id);
    
    -- Insert locked event
    INSERT INTO public.formalization_events (formalization_id, event_type, actor_user_id, meta)
    VALUES (NEW.id, 'locked', NEW.created_by, jsonb_build_object('locked_hash', NEW.locked_hash));
  END IF;
  
  -- If already locked, prevent changes to protected fields (except status to 'voided')
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.title != OLD.title 
       OR NEW.summary != OLD.summary 
       OR NEW.body_md != OLD.body_md 
       OR NEW.data != OLD.data 
       OR NEW.type != OLD.type 
       OR NEW.project_id IS DISTINCT FROM OLD.project_id 
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
      RAISE EXCEPTION 'Cannot modify locked formalization content';
    END IF;
    
    -- Only allow status change to 'voided' after lock
    IF NEW.status != OLD.status AND NEW.status != 'voided' THEN
      RAISE EXCEPTION 'Locked formalization can only be voided';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for lock handling
CREATE TRIGGER handle_formalization_lock_trigger
  BEFORE UPDATE ON public.formalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_formalization_lock();

-- Indexes for performance
CREATE INDEX idx_formalizations_org_status_activity ON public.formalizations(customer_org_id, status, last_activity_at DESC);
CREATE INDEX idx_formalizations_project_status ON public.formalizations(project_id, status);
CREATE INDEX idx_formalization_events_formalization_created ON public.formalization_events(formalization_id, created_at);
CREATE INDEX idx_formalization_acknowledgements_formalization ON public.formalization_acknowledgements(formalization_id);
CREATE INDEX idx_formalization_parties_formalization ON public.formalization_parties(formalization_id);
CREATE INDEX idx_formalization_attachments_formalization ON public.formalization_attachments(formalization_id);
CREATE INDEX idx_formalization_evidence_links_formalization ON public.formalization_evidence_links(formalization_id);

-- Enable RLS on all tables
ALTER TABLE public.formalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formalization_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formalization_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formalization_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formalization_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formalization_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for formalizations
CREATE POLICY "Users can view formalizations they created or are party to"
  ON public.formalizations
  FOR SELECT
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.formalization_parties 
      WHERE formalization_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create formalizations"
  ON public.formalizations
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their draft formalizations"
  ON public.formalizations
  FOR UPDATE
  USING (created_by = auth.uid());

-- RLS Policies for formalization_parties
CREATE POLICY "Users can view parties of accessible formalizations"
  ON public.formalization_parties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Formalization creators can manage parties"
  ON public.formalization_parties
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id AND f.created_by = auth.uid()
    )
  );

-- RLS Policies for formalization_acknowledgements
CREATE POLICY "Users can view acknowledgements of accessible formalizations"
  ON public.formalization_acknowledgements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Parties can create their own acknowledgements"
  ON public.formalization_acknowledgements
  FOR INSERT
  WITH CHECK (
    acknowledged_by_user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.formalization_parties p 
      WHERE p.id = party_id AND p.user_id = auth.uid()
    )
  );

-- RLS Policies for formalization_evidence_links
CREATE POLICY "Users can view evidence links of accessible formalizations"
  ON public.formalization_evidence_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can add evidence links to accessible formalizations"
  ON public.formalization_evidence_links
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

-- RLS Policies for formalization_attachments
CREATE POLICY "Users can view attachments of accessible formalizations"
  ON public.formalization_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can add attachments to accessible formalizations"
  ON public.formalization_attachments
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

-- RLS Policies for formalization_events
CREATE POLICY "Users can view events of accessible formalizations"
  ON public.formalization_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f 
      WHERE f.id = formalization_id 
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "System can insert events"
  ON public.formalization_events
  FOR INSERT
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);

-- Storage policies for formalization-attachments bucket
CREATE POLICY "Users can view attachments they have access to"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'formalization-attachments'
    AND EXISTS (
      SELECT 1 FROM public.formalization_attachments a
      JOIN public.formalizations f ON f.id = a.formalization_id
      WHERE a.storage_path = name
      AND (f.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.formalization_parties p 
        WHERE p.formalization_id = f.id AND p.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can upload attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'formalization-attachments'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'formalization-attachments'
    AND EXISTS (
      SELECT 1 FROM public.formalization_attachments a
      WHERE a.storage_path = name AND a.uploaded_by = auth.uid()
    )
  );