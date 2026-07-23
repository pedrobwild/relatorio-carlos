ALTER TABLE public.project_daily_logs
  ADD COLUMN IF NOT EXISTS weather_morning text,
  ADD COLUMN IF NOT EXISTS weather_afternoon text,
  ADD COLUMN IF NOT EXISTS temperature_c numeric(4,1);

COMMENT ON COLUMN public.project_daily_logs.weather_morning IS
  'Condição climática da manhã: Ensolarado | Nublado | Chuva | Impraticável';
COMMENT ON COLUMN public.project_daily_logs.weather_afternoon IS
  'Condição climática da tarde: Ensolarado | Nublado | Chuva | Impraticável';
COMMENT ON COLUMN public.project_daily_logs.temperature_c IS
  'Temperatura estimada em °C (entrada manual, opcional).';