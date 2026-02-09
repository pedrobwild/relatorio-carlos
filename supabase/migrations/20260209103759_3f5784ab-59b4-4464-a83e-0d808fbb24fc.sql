-- Create table for project team contacts
CREATE TABLE public.project_team_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL, -- 'engenharia', 'arquitetura', 'relacionamento'
    display_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    crea TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, role_type)
);

-- Create index for faster lookups
CREATE INDEX idx_project_team_contacts_project_id ON public.project_team_contacts(project_id);

-- Enable RLS
ALTER TABLE public.project_team_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policy: anyone with project access can read team contacts
CREATE POLICY "Users with project access can view team contacts"
ON public.project_team_contacts
FOR SELECT
USING (has_project_access(auth.uid(), project_id));

-- RLS policy: staff can insert/update/delete team contacts
CREATE POLICY "Staff can manage team contacts"
ON public.project_team_contacts
FOR ALL
USING (
    has_project_access(auth.uid(), project_id) 
    AND (
        has_role(auth.uid(), 'admin'::app_role) 
        OR has_role(auth.uid(), 'engineer'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
    )
)
WITH CHECK (
    has_project_access(auth.uid(), project_id) 
    AND (
        has_role(auth.uid(), 'admin'::app_role) 
        OR has_role(auth.uid(), 'engineer'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
    )
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_project_team_contacts_updated_at
    BEFORE UPDATE ON public.project_team_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();