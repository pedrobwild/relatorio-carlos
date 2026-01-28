-- ============================================================================
-- FILES TABLE: Scalable File Storage with Metadata
-- ============================================================================
-- This table provides centralized file metadata management with:
-- - Deterministic storage paths
-- - Lifecycle management (soft delete, archival)
-- - Deduplication via checksum
-- - Full audit trail
-- ============================================================================

-- Status enum for file lifecycle
CREATE TYPE public.file_status AS ENUM ('active', 'archived', 'deleted');

-- Visibility enum for access control
CREATE TYPE public.file_visibility AS ENUM ('private', 'team', 'public');

-- Create the files table
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Storage location
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  
  -- Ownership and project association
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.orgs(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- File metadata
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT, -- SHA256 hash for deduplication
  
  -- Categorization
  category TEXT, -- e.g., 'documento', 'foto', 'video', 'contrato'
  tags JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  
  -- Lifecycle management
  status public.file_status NOT NULL DEFAULT 'active',
  visibility public.file_visibility NOT NULL DEFAULT 'private',
  retention_days INTEGER, -- NULL = keep forever
  expires_at TIMESTAMPTZ, -- Computed: created_at + retention_days
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Relationships to entities
  entity_type TEXT, -- 'formalization', 'weekly_report', 'payment', etc.
  entity_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint on storage path per bucket
  CONSTRAINT files_bucket_path_unique UNIQUE (bucket, storage_path)
);

-- ============================================================================
-- INDEXES for common query patterns
-- ============================================================================

-- Owner queries (my files)
CREATE INDEX idx_files_owner_id ON public.files (owner_id);

-- Project queries (project files)
CREATE INDEX idx_files_project_id ON public.files (project_id) WHERE project_id IS NOT NULL;

-- Organization queries
CREATE INDEX idx_files_org_id ON public.files (org_id) WHERE org_id IS NOT NULL;

-- Status filtering (active files)
CREATE INDEX idx_files_status ON public.files (status);

-- Entity relationship queries
CREATE INDEX idx_files_entity ON public.files (entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- Checksum for deduplication lookups
CREATE INDEX idx_files_checksum ON public.files (checksum) WHERE checksum IS NOT NULL;

-- Lifecycle queries (cleanup jobs)
CREATE INDEX idx_files_deleted_at ON public.files (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_files_expires_at ON public.files (expires_at) WHERE expires_at IS NOT NULL;

-- Tags GIN index for JSONB queries
CREATE INDEX idx_files_tags ON public.files USING GIN (tags);

-- Created at for time-series queries
CREATE INDEX idx_files_created_at ON public.files (created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Owners can do everything with their files
CREATE POLICY "Owners have full access to their files"
ON public.files
FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Project members can view project files
CREATE POLICY "Project members can view project files"
ON public.files
FOR SELECT
USING (
  project_id IS NOT NULL 
  AND public.has_project_access(auth.uid(), project_id)
);

-- Staff can manage project files
CREATE POLICY "Staff can manage project files"
ON public.files
FOR ALL
USING (
  project_id IS NOT NULL 
  AND public.can_manage_project(auth.uid(), project_id)
)
WITH CHECK (
  project_id IS NOT NULL 
  AND public.can_manage_project(auth.uid(), project_id)
);

-- Admins have full access
CREATE POLICY "Admins have full access to all files"
ON public.files
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.files_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_updated_at_trigger
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.files_update_updated_at();

-- ============================================================================
-- TRIGGER: Set expires_at based on retention_days
-- ============================================================================

CREATE OR REPLACE FUNCTION public.files_set_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.retention_days IS NOT NULL THEN
    NEW.expires_at = NEW.created_at + (NEW.retention_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_expires_at_trigger
BEFORE INSERT OR UPDATE OF retention_days ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.files_set_expires_at();

-- ============================================================================
-- TRIGGER: Set timestamps on lifecycle changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.files_lifecycle_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set archived_at when status changes to archived
  IF NEW.status = 'archived' AND OLD.status != 'archived' THEN
    NEW.archived_at = now();
  END IF;
  
  -- Set deleted_at when status changes to deleted (soft delete)
  IF NEW.status = 'deleted' AND OLD.status != 'deleted' THEN
    NEW.deleted_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER files_lifecycle_trigger
BEFORE UPDATE OF status ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.files_lifecycle_timestamps();

-- ============================================================================
-- HELPER FUNCTION: Generate deterministic storage path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_file_storage_path(
  p_org_id UUID,
  p_project_id UUID,
  p_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_uuid TEXT;
  v_safe_name TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_month := to_char(now(), 'MM');
  v_uuid := gen_random_uuid()::text;
  
  -- Sanitize filename: remove path traversal, limit length
  v_safe_name := regexp_replace(p_filename, '[^a-zA-Z0-9._-]', '_', 'g');
  v_safe_name := left(v_safe_name, 100);
  
  -- Path pattern: /{org_id}/{project_id}/{yyyy}/{mm}/{uuid}_{filename}
  RETURN format(
    '%s/%s/%s/%s/%s_%s',
    COALESCE(p_org_id::text, 'shared'),
    COALESCE(p_project_id::text, 'general'),
    v_year,
    v_month,
    v_uuid,
    v_safe_name
  );
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Check for duplicate files by checksum
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_duplicate_file(
  p_checksum TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  bucket TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.storage_path, f.bucket
  FROM public.files f
  WHERE f.checksum = p_checksum
    AND f.status = 'active'
    AND (p_owner_id IS NULL OR f.owner_id = p_owner_id)
    AND (p_project_id IS NULL OR f.project_id = p_project_id)
  LIMIT 1;
$$;

-- ============================================================================
-- VIEW: Files with signed URL support info
-- ============================================================================

CREATE OR REPLACE VIEW public.files_summary AS
SELECT 
  f.id,
  f.bucket,
  f.storage_path,
  f.original_name,
  f.mime_type,
  f.size_bytes,
  f.category,
  f.status,
  f.visibility,
  f.project_id,
  p.name as project_name,
  f.entity_type,
  f.entity_id,
  f.created_at,
  f.owner_id,
  pr.display_name as owner_name
FROM public.files f
LEFT JOIN public.projects p ON p.id = f.project_id
LEFT JOIN public.profiles pr ON pr.user_id = f.owner_id
WHERE f.status = 'active';

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.files IS 'Centralized file metadata for scalable storage management';
COMMENT ON COLUMN public.files.checksum IS 'SHA256 hash for deduplication and integrity verification';
COMMENT ON COLUMN public.files.retention_days IS 'Days to keep file before auto-expiration (NULL = forever)';
COMMENT ON COLUMN public.files.entity_type IS 'Type of entity this file is attached to (e.g., formalization, report)';
COMMENT ON COLUMN public.files.entity_id IS 'ID of the entity this file is attached to';
COMMENT ON FUNCTION public.generate_file_storage_path IS 'Generates deterministic, secure storage paths';