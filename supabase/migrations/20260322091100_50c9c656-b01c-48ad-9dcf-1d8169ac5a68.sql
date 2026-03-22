
-- Chat messages per journey stage
CREATE TABLE public.journey_stage_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'customer',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_stage_messages_stage ON public.journey_stage_messages(stage_id, created_at);

-- Enable RLS
ALTER TABLE public.journey_stage_messages ENABLE ROW LEVEL SECURITY;

-- Policy: project members can read messages
CREATE POLICY "Project members can read stage messages"
  ON public.journey_stage_messages FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

-- Policy: authenticated users with project access can insert
CREATE POLICY "Project members can send stage messages"
  ON public.journey_stage_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_access(auth.uid(), project_id)
    AND author_id = auth.uid()
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.journey_stage_messages;
