-- Domain Events table for audit trail / event sourcing light
CREATE TABLE public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id),
  project_id UUID REFERENCES public.projects(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_domain_events_org_created ON public.domain_events (org_id, created_at DESC);
CREATE INDEX idx_domain_events_project_created ON public.domain_events (project_id, created_at DESC);
CREATE INDEX idx_domain_events_entity ON public.domain_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_domain_events_event_type ON public.domain_events (event_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see events from their org/projects
CREATE POLICY "Users can view events from their projects"
ON public.domain_events FOR SELECT
USING (
  public.is_project_member(auth.uid(), project_id) 
  OR public.user_in_org(auth.uid(), org_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Only system/staff can insert events (prevents tampering)
CREATE POLICY "Staff can insert events"
ON public.domain_events FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid()) 
  OR public.has_role(auth.uid(), 'admin')
  OR actor_user_id = auth.uid()
);

-- Events are immutable - no updates or deletes
CREATE POLICY "Events are immutable - no updates"
ON public.domain_events FOR UPDATE
USING (false);

CREATE POLICY "Events are immutable - no deletes"
ON public.domain_events FOR DELETE
USING (public.has_role(auth.uid(), 'admin')); -- Only admins can delete for GDPR compliance

-- Helper function to log domain events (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.log_domain_event(
  _org_id UUID,
  _project_id UUID,
  _entity_type TEXT,
  _entity_id UUID,
  _event_type TEXT,
  _payload JSONB DEFAULT '{}'::jsonb,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.domain_events (
    org_id,
    project_id,
    entity_type,
    entity_id,
    event_type,
    payload,
    actor_user_id,
    ip_address,
    user_agent
  ) VALUES (
    _org_id,
    _project_id,
    _entity_type,
    _entity_id,
    _event_type,
    _payload,
    auth.uid(),
    _ip_address,
    _user_agent
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;