
ALTER TABLE public.project_studio_info
  ADD COLUMN IF NOT EXISTS building_manager_name text,
  ADD COLUMN IF NOT EXISTS building_manager_email text,
  ADD COLUMN IF NOT EXISTS building_manager_phone text,
  ADD COLUMN IF NOT EXISTS syndic_name text,
  ADD COLUMN IF NOT EXISTS syndic_email text,
  ADD COLUMN IF NOT EXISTS syndic_phone text,
  ADD COLUMN IF NOT EXISTS allowed_work_days text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_work_start_time text,
  ADD COLUMN IF NOT EXISTS allowed_work_end_time text;
