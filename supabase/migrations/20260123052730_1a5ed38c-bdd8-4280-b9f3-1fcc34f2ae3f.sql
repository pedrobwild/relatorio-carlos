-- Drop conflicting constraint to keep only one
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_document_type_check;