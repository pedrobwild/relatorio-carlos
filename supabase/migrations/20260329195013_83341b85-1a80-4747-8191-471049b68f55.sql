
-- =====================================================
-- ENUM types for inspections and non-conformities
-- =====================================================

CREATE TYPE public.inspection_status AS ENUM ('draft', 'in_progress', 'completed');
CREATE TYPE public.inspection_item_result AS ENUM ('approved', 'rejected', 'not_applicable', 'pending');
CREATE TYPE public.nc_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.nc_status AS ENUM ('open', 'in_treatment', 'pending_verification', 'pending_approval', 'closed', 'reopened');

-- =====================================================
-- Inspections (Vistorias)
-- =====================================================

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.project_activities(id) ON DELETE SET NULL,
  inspector_id uuid NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.inspection_status NOT NULL DEFAULT 'draft',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Staff with project access can manage
CREATE POLICY "Staff can manage inspections"
  ON public.inspections FOR ALL
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Anyone with project access can view
CREATE POLICY "Users with project access can view inspections"
  ON public.inspections FOR SELECT
  TO public
  USING (has_project_access(auth.uid(), project_id));

-- =====================================================
-- Inspection Items (Itens do checklist)
-- =====================================================

CREATE TABLE public.inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  description text NOT NULL,
  result public.inspection_item_result NOT NULL DEFAULT 'pending',
  notes text,
  photo_paths text[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

-- Staff can manage items via inspection access
CREATE POLICY "Staff can manage inspection items"
  ON public.inspection_items FOR ALL
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_items.inspection_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), i.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_items.inspection_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), i.project_id)
  ));

-- View via project access
CREATE POLICY "Users can view inspection items"
  ON public.inspection_items FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_items.inspection_id
      AND has_project_access(auth.uid(), i.project_id)
  ));

-- =====================================================
-- Non-Conformities (Não Conformidades)
-- =====================================================

CREATE TABLE public.non_conformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inspection_id uuid REFERENCES public.inspections(id) ON DELETE SET NULL,
  inspection_item_id uuid REFERENCES public.inspection_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity public.nc_severity NOT NULL DEFAULT 'medium',
  status public.nc_status NOT NULL DEFAULT 'open',
  responsible_user_id uuid,
  deadline date,
  corrective_action text,
  evidence_photo_paths text[] DEFAULT '{}',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  verified_at timestamptz,
  verified_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.non_conformities ENABLE ROW LEVEL SECURITY;

-- Staff can manage NCs
CREATE POLICY "Staff can manage non conformities"
  ON public.non_conformities FOR ALL
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Anyone with project access can view NCs
CREATE POLICY "Users with project access can view non conformities"
  ON public.non_conformities FOR SELECT
  TO public
  USING (has_project_access(auth.uid(), project_id));

-- =====================================================
-- NC History / Action Log
-- =====================================================

CREATE TABLE public.nc_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.non_conformities(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status public.nc_status,
  new_status public.nc_status,
  notes text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nc_history ENABLE ROW LEVEL SECURITY;

-- Staff can insert history
CREATE POLICY "Staff can insert nc history"
  ON public.nc_history FOR INSERT
  TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.non_conformities nc
    WHERE nc.id = nc_history.nc_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), nc.project_id)
  ));

-- View via project access
CREATE POLICY "Users can view nc history"
  ON public.nc_history FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.non_conformities nc
    WHERE nc.id = nc_history.nc_id
      AND has_project_access(auth.uid(), nc.project_id)
  ));

-- No update/delete on history (immutable log)
CREATE POLICY "nc_history_no_update"
  ON public.nc_history FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "nc_history_no_delete"
  ON public.nc_history FOR DELETE
  TO public
  USING (false);
