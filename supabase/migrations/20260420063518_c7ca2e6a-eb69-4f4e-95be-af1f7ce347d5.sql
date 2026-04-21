
-- Remove demo duplicates (keep oldest = original)
WITH demos AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.projects
  WHERE name = 'DEMO | Apartamento Modelo Brooklin'
),
to_delete AS (SELECT id FROM demos WHERE rn > 1)
DELETE FROM public.projects WHERE id IN (SELECT id FROM to_delete);

-- Update demo user password directly in auth.users
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf')),
    updated_at = now()
WHERE email = 'demo@bwild.com.br';
