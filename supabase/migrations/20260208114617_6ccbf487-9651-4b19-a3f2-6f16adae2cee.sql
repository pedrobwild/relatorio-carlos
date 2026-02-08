-- Create table for document comments/annotations per version
CREATE TABLE public.project_document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  page_number INTEGER, -- nullable, only for PDFs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_document_comments_document ON public.project_document_comments(document_id);
CREATE INDEX idx_document_comments_project ON public.project_document_comments(project_id);
CREATE INDEX idx_document_comments_user ON public.project_document_comments(user_id);

-- Enable RLS
ALTER TABLE public.project_document_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: follows project access rules
-- SELECT: anyone with project access can view comments
CREATE POLICY "project_document_comments_select"
ON public.project_document_comments
FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

-- INSERT: staff members can add comments
CREATE POLICY "project_document_comments_insert"
ON public.project_document_comments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_project_access(auth.uid(), project_id)
  AND public.is_staff(auth.uid())
);

-- UPDATE: only comment author can update
CREATE POLICY "project_document_comments_update"
ON public.project_document_comments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: only comment author or admin can delete
CREATE POLICY "project_document_comments_delete"
ON public.project_document_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_document_comments_updated_at
BEFORE UPDATE ON public.project_document_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();