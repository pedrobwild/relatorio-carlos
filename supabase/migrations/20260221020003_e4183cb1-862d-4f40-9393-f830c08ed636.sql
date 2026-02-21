-- Add contract signing date to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contract_signing_date date;