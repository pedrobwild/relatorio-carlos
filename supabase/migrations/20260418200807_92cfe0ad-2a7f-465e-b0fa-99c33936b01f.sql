-- Remove ambiguous old 6-arg version of create_inspection_with_items.
-- The 9-arg version (with inspection_type, client_present, client_name) is the canonical one.
DROP FUNCTION IF EXISTS public.create_inspection_with_items(uuid, uuid, uuid, date, text, jsonb);