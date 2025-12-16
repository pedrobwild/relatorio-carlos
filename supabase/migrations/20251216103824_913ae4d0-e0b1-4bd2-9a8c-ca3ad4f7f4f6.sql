-- Add missing columns to project_documents for full document management
ALTER TABLE public.project_documents 
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.project_documents(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_documents_project_type ON public.project_documents(project_id, document_type);
CREATE INDEX IF NOT EXISTS idx_project_documents_parent ON public.project_documents(parent_document_id);

-- Add comment for document_type categories
COMMENT ON COLUMN public.project_documents.document_type IS 'Categories: contrato, aditivo, projeto_3d, executivo, art_rrt, plano_reforma, nota_fiscal, garantia, as_built, termo_entrega';