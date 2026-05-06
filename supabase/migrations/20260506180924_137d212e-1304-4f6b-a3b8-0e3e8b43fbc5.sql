UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','image/gif',
  'video/mp4','video/quicktime','video/webm','video/x-m4v','video/3gpp','video/3gpp2','video/x-matroska'
],
file_size_limit = 209715200
WHERE id = 'weekly-reports';