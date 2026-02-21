-- Add payment_method column to project_payments
ALTER TABLE public.project_payments ADD COLUMN IF NOT EXISTS payment_method text;