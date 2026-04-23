-- No-op migration para forçar regeneração dos TypeScript types
-- após criação das tabelas de Registro Diário de Obra.
COMMENT ON TABLE public.project_daily_logs IS 'Registro diário de obra: uma folha por (projeto, data) com notas livres, serviços em execução e prestadores no local.';
COMMENT ON TABLE public.project_daily_log_services IS 'Serviços em execução em um determinado dia de obra (filho de project_daily_logs).';
COMMENT ON TABLE public.project_daily_log_workers IS 'Prestadores presentes no local em um determinado dia de obra (filho de project_daily_logs).';