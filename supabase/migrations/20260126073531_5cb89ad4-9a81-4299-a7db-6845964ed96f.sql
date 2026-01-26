
-- Add checksum column to project_documents table
ALTER TABLE public.project_documents 
ADD COLUMN IF NOT EXISTS checksum text;

-- Add index for checksum lookups (for integrity verification)
CREATE INDEX IF NOT EXISTS idx_project_documents_checksum 
ON public.project_documents (checksum) 
WHERE checksum IS NOT NULL;
