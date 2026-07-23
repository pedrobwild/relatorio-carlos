
CREATE TABLE public.inspection_checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_checklist_templates TO authenticated;
GRANT ALL ON public.inspection_checklist_templates TO service_role;

ALTER TABLE public.inspection_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view checklist templates"
  ON public.inspection_checklist_templates
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert checklist templates"
  ON public.inspection_checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update checklist templates"
  ON public.inspection_checklist_templates
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete checklist templates"
  ON public.inspection_checklist_templates
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_inspection_checklist_templates_updated_at
  BEFORE UPDATE ON public.inspection_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_inspection_checklist_templates_active
  ON public.inspection_checklist_templates (is_active, category);

CREATE TABLE public.inspection_checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.inspection_checklist_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_checklist_template_items TO authenticated;
GRANT ALL ON public.inspection_checklist_template_items TO service_role;

ALTER TABLE public.inspection_checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view checklist template items"
  ON public.inspection_checklist_template_items
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert checklist template items"
  ON public.inspection_checklist_template_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update checklist template items"
  ON public.inspection_checklist_template_items
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete checklist template items"
  ON public.inspection_checklist_template_items
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_inspection_checklist_template_items_template
  ON public.inspection_checklist_template_items (template_id, sort_order);
