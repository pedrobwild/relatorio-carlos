
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS inspection_type TEXT NOT NULL DEFAULT 'rotina',
  ADD COLUMN IF NOT EXISTS inspector_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS client_present BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_name TEXT;
