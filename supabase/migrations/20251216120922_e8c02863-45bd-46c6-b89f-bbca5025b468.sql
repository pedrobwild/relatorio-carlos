-- P0: Multi-tenant Architecture
-- 1. Create orgs table (organizations/companies)
CREATE TABLE public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on orgs
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- 2. Create units table (apartments/units within projects)
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- 3. Add org_id to projects table
ALTER TABLE public.projects ADD COLUMN org_id UUID REFERENCES public.orgs(id);

-- 4. Create unified project_members table
CREATE TYPE public.project_role AS ENUM ('owner', 'engineer', 'viewer', 'customer');

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer functions for multi-tenant access

-- Check if user belongs to an org
CREATE OR REPLACE FUNCTION public.user_in_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.user_id = _user_id AND p.org_id = _org_id
  )
$$;

-- Check if user is member of a project
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Check if user has specific role in project
CREATE OR REPLACE FUNCTION public.has_project_role(_user_id UUID, _project_id UUID, _role project_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id 
      AND project_id = _project_id 
      AND role = _role
  )
$$;

-- Check if user can manage project (owner or engineer)
CREATE OR REPLACE FUNCTION public.can_manage_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id 
      AND project_id = _project_id 
      AND role IN ('owner', 'engineer')
  ) OR public.has_role(_user_id, 'admin')
$$;

-- 6. RLS Policies for orgs
CREATE POLICY "Users can view orgs they belong to"
ON public.orgs FOR SELECT
USING (public.user_in_org(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage orgs"
ON public.orgs FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 7. RLS Policies for units
CREATE POLICY "Users can view units of their projects"
ON public.units FOR SELECT
USING (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage units"
ON public.units FOR ALL
USING (public.can_manage_project(auth.uid(), project_id));

-- 8. RLS Policies for project_members
CREATE POLICY "Users can view members of their projects"
ON public.project_members FOR SELECT
USING (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project managers can manage members"
ON public.project_members FOR INSERT
WITH CHECK (public.can_manage_project(auth.uid(), project_id));

CREATE POLICY "Project managers can update members"
ON public.project_members FOR UPDATE
USING (public.can_manage_project(auth.uid(), project_id));

CREATE POLICY "Project managers can delete members"
ON public.project_members FOR DELETE
USING (public.can_manage_project(auth.uid(), project_id));

-- 9. Update triggers for updated_at
CREATE TRIGGER update_orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_updated_at();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_updated_at();