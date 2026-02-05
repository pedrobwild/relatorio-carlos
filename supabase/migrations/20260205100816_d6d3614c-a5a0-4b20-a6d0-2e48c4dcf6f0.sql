-- Allow due_date to be nullable for "Em definição" state
ALTER TABLE public.project_payments ALTER COLUMN due_date DROP NOT NULL;