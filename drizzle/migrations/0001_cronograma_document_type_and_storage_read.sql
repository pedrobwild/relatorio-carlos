ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_document_type_check;
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_document_type_check
  CHECK (document_type = ANY (ARRAY['contrato','aditivo','projeto_3d','executivo','art_rrt','plano_reforma','nota_fiscal','garantia','as_built','termo_entrega','cronograma']::text[]));

-- Arquivos gravados pelo filesRepo usam {org}/{project}/...; quem tem acesso à obra lê.
CREATE POLICY "Project members can view project files by second segment"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND public.has_project_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
);