
-- Identify duplicates (keep only the most recent demo project)
WITH demos AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
  FROM public.projects
  WHERE name = 'DEMO | Apartamento Modelo Brooklin'
),
to_delete AS (
  SELECT id FROM demos WHERE rn > 1
)
DELETE FROM public.projects WHERE id IN (SELECT id FROM to_delete);
