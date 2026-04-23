ALTER TYPE public.painel_etapa_enum ADD VALUE IF NOT EXISTS 'Execução';
ALTER TYPE public.painel_etapa_enum ADD VALUE IF NOT EXISTS 'Vistoria';
ALTER TYPE public.painel_etapa_enum ADD VALUE IF NOT EXISTS 'Vistoria reprovada';
ALTER TYPE public.painel_etapa_enum ADD VALUE IF NOT EXISTS 'Finalizada';
ALTER TYPE public.painel_status_enum ADD VALUE IF NOT EXISTS 'Aguardando';