-- Tornar datas opcionais para permitir projetos em fase de projeto sem cronograma definido
ALTER TABLE public.projects
  ALTER COLUMN planned_start_date DROP NOT NULL,
  ALTER COLUMN planned_end_date DROP NOT NULL;