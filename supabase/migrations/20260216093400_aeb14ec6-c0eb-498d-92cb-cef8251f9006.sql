
-- Table for multiple team members per project (supports the "Seu Time" block)
CREATE TABLE public.journey_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journey_team_members ENABLE ROW LEVEL SECURITY;

-- Staff can manage team members
CREATE POLICY "Staff can manage team members"
  ON public.journey_team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'engineer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'engineer')
    )
  );

-- Customers can view team members of their projects
CREATE POLICY "Customers can view team members"
  ON public.journey_team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_customers
      WHERE project_customers.project_id = journey_team_members.project_id
      AND project_customers.customer_user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_journey_team_members_project ON public.journey_team_members(project_id, sort_order);

-- Trigger for updated_at
CREATE TRIGGER update_journey_team_members_updated_at
  BEFORE UPDATE ON public.journey_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing CSM data into the new table (migrate journey_csm entries)
INSERT INTO public.journey_team_members (project_id, display_name, role_title, description, email, phone, photo_url, sort_order)
SELECT project_id, name, role_title, description, email, phone, photo_url, 0
FROM public.journey_csm;
