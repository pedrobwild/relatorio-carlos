
-- Add revision request columns to project_3d_versions
ALTER TABLE public.project_3d_versions
  ADD COLUMN revision_requested_at timestamptz DEFAULT NULL,
  ADD COLUMN revision_requested_by uuid DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.project_3d_versions.revision_requested_at IS 'Timestamp when client requested a revision for this version';
COMMENT ON COLUMN public.project_3d_versions.revision_requested_by IS 'User ID of the client who requested the revision';
