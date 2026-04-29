
-- 1) Coluna "marca" opcional em project_purchases
ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- 2) Tabela de anexos (imagens/documentos) por requisição de compra
CREATE TABLE IF NOT EXISTS public.project_purchase_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'purchase-attachments',
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppa_purchase_id ON public.project_purchase_attachments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_ppa_project_id ON public.project_purchase_attachments(project_id);

ALTER TABLE public.project_purchase_attachments ENABLE ROW LEVEL SECURITY;

-- Visualizar: quem tem acesso ao projeto
CREATE POLICY "ppa_select_project_access"
ON public.project_purchase_attachments
FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

-- Inserir: quem tem acesso ao projeto e está marcando como uploader
CREATE POLICY "ppa_insert_project_access"
ON public.project_purchase_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_project_access(auth.uid(), project_id)
  AND uploaded_by = auth.uid()
);

-- Remover: staff ou quem fez o upload
CREATE POLICY "ppa_delete_uploader_or_staff"
ON public.project_purchase_attachments
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid() OR public.is_staff(auth.uid())
);

-- 3) Bucket privado para os anexos de compras
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-attachments', 'purchase-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage: o primeiro segmento do path = project_id
CREATE POLICY "purchase_attachments_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-attachments'
  AND public.has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "purchase_attachments_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-attachments'
  AND public.has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "purchase_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-attachments'
  AND (
    public.is_staff(auth.uid())
    OR owner = auth.uid()
  )
);
