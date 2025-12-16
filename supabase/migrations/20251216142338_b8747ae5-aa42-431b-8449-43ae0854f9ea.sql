-- ============================================
-- Data Consistency Constraints Migration
-- ============================================

-- 1. project_documents constraints
ALTER TABLE public.project_documents
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN document_type SET NOT NULL,
  ALTER COLUMN storage_path SET NOT NULL,
  ALTER COLUMN uploaded_by SET NOT NULL;

-- Check constraint for document_type
ALTER TABLE public.project_documents
  DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.project_documents
  ADD CONSTRAINT documents_type_check
  CHECK (document_type IN ('contrato', 'aditivo', 'projeto_3d', 'executivo', 'art_rrt', 'plano_reforma', 'nota_fiscal', 'garantia', 'as_built', 'termo_entrega'));

-- Check constraint for document status
ALTER TABLE public.project_documents
  DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.project_documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending', 'approved'));

-- Unique constraint for document version per parent
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_version 
  ON public.project_documents (COALESCE(parent_document_id, id), version);

-- 2. projects constraints with RESTRICT
ALTER TABLE public.projects
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN planned_start_date SET NOT NULL,
  ALTER COLUMN planned_end_date SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL;

-- Check constraint for project status
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'paused', 'cancelled'));

-- 3. pending_items constraints
ALTER TABLE public.pending_items
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN customer_org_id SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL;

-- Check constraint for pending_items status
ALTER TABLE public.pending_items
  DROP CONSTRAINT IF EXISTS pending_items_status_check;
ALTER TABLE public.pending_items
  ADD CONSTRAINT pending_items_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));

-- 4. formalizations constraints
ALTER TABLE public.formalizations
  ALTER COLUMN customer_org_id SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN summary SET NOT NULL,
  ALTER COLUMN body_md SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL;

-- 5. project_payments constraints
ALTER TABLE public.project_payments
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN installment_number SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL,
  ALTER COLUMN description SET NOT NULL;

-- Unique constraint for payment installment per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_installment
  ON public.project_payments (project_id, installment_number);

-- Check constraint for positive amounts
ALTER TABLE public.project_payments
  DROP CONSTRAINT IF EXISTS payments_positive_amount;
ALTER TABLE public.project_payments
  ADD CONSTRAINT payments_positive_amount
  CHECK (amount > 0);

-- 6. project_members constraints
ALTER TABLE public.project_members
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

-- Unique constraint: one role per user per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_user_project
  ON public.project_members (project_id, user_id);

-- 7. formalization_parties constraints
ALTER TABLE public.formalization_parties
  ALTER COLUMN formalization_id SET NOT NULL,
  ALTER COLUMN party_type SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL;

-- 8. formalization_acknowledgements constraints  
ALTER TABLE public.formalization_acknowledgements
  ALTER COLUMN formalization_id SET NOT NULL,
  ALTER COLUMN party_id SET NOT NULL;

-- 9. domain_events constraints (audit trail integrity)
ALTER TABLE public.domain_events
  ALTER COLUMN org_id SET NOT NULL,
  ALTER COLUMN entity_type SET NOT NULL,
  ALTER COLUMN entity_id SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL;

-- 10. Add ON DELETE RESTRICT foreign keys to prevent accidental data loss
-- First drop existing constraints if they exist, then recreate with RESTRICT

-- project_documents -> projects (RESTRICT)
ALTER TABLE public.project_documents
  DROP CONSTRAINT IF EXISTS project_documents_project_id_fkey;
ALTER TABLE public.project_documents
  ADD CONSTRAINT project_documents_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- project_payments -> projects (RESTRICT)
ALTER TABLE public.project_payments
  DROP CONSTRAINT IF EXISTS project_payments_project_id_fkey;
ALTER TABLE public.project_payments
  ADD CONSTRAINT project_payments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- pending_items -> projects (RESTRICT)
ALTER TABLE public.pending_items
  DROP CONSTRAINT IF EXISTS pending_items_project_id_fkey;
ALTER TABLE public.pending_items
  ADD CONSTRAINT pending_items_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- project_members -> projects (RESTRICT)
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- formalizations -> projects (RESTRICT, nullable)
ALTER TABLE public.formalizations
  DROP CONSTRAINT IF EXISTS formalizations_project_id_fkey;
ALTER TABLE public.formalizations
  ADD CONSTRAINT formalizations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- formalization_parties -> formalizations (RESTRICT)
ALTER TABLE public.formalization_parties
  DROP CONSTRAINT IF EXISTS formalization_parties_formalization_id_fkey;
ALTER TABLE public.formalization_parties
  ADD CONSTRAINT formalization_parties_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- formalization_acknowledgements -> formalizations (RESTRICT)
ALTER TABLE public.formalization_acknowledgements
  DROP CONSTRAINT IF EXISTS formalization_acknowledgements_formalization_id_fkey;
ALTER TABLE public.formalization_acknowledgements
  ADD CONSTRAINT formalization_acknowledgements_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- formalization_acknowledgements -> formalization_parties (RESTRICT)
ALTER TABLE public.formalization_acknowledgements
  DROP CONSTRAINT IF EXISTS formalization_acknowledgements_party_id_fkey;
ALTER TABLE public.formalization_acknowledgements
  ADD CONSTRAINT formalization_acknowledgements_party_id_fkey
  FOREIGN KEY (party_id) REFERENCES public.formalization_parties(id) ON DELETE RESTRICT;

-- formalization_versions -> formalizations (RESTRICT)
ALTER TABLE public.formalization_versions
  DROP CONSTRAINT IF EXISTS formalization_versions_formalization_id_fkey;
ALTER TABLE public.formalization_versions
  ADD CONSTRAINT formalization_versions_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- formalization_events -> formalizations (RESTRICT)
ALTER TABLE public.formalization_events
  DROP CONSTRAINT IF EXISTS formalization_events_formalization_id_fkey;
ALTER TABLE public.formalization_events
  ADD CONSTRAINT formalization_events_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- formalization_attachments -> formalizations (RESTRICT)
ALTER TABLE public.formalization_attachments
  DROP CONSTRAINT IF EXISTS formalization_attachments_formalization_id_fkey;
ALTER TABLE public.formalization_attachments
  ADD CONSTRAINT formalization_attachments_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- formalization_evidence_links -> formalizations (RESTRICT)
ALTER TABLE public.formalization_evidence_links
  DROP CONSTRAINT IF EXISTS formalization_evidence_links_formalization_id_fkey;
ALTER TABLE public.formalization_evidence_links
  ADD CONSTRAINT formalization_evidence_links_formalization_id_fkey
  FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE RESTRICT;

-- 11. Add check for dates consistency in projects
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_dates_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_dates_check
  CHECK (planned_end_date >= planned_start_date);

-- 12. Ensure positive version numbers
ALTER TABLE public.project_documents
  DROP CONSTRAINT IF EXISTS documents_version_positive;
ALTER TABLE public.project_documents
  ADD CONSTRAINT documents_version_positive
  CHECK (version > 0);

ALTER TABLE public.formalization_versions
  DROP CONSTRAINT IF EXISTS formalization_versions_positive;
ALTER TABLE public.formalization_versions
  ADD CONSTRAINT formalization_versions_positive
  CHECK (version_number > 0);