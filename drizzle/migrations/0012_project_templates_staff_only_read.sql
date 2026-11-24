-- Modelos de obra são dado interno: só a equipe lê.
-- A policy "Staff can manage templates" (ALL, is_staff) já cobre leitura e escrita da equipe.
DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.project_templates;