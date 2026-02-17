-- Make project-documents bucket public so getPublicUrl works for team photos
-- RLS policies still control who can upload/delete
UPDATE storage.buckets SET public = true WHERE id = 'project-documents';