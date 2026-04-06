-- Add 'arquitetura' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'arquitetura';

-- Update profiles role check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['customer','staff','manager','admin','engineer','suprimentos','financeiro','gestor','cs','arquitetura']));