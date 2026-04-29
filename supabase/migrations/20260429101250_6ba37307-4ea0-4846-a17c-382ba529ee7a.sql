-- Adiciona vínculo opcional de prestador (fornecedor) em cada atividade do
-- cronograma. Usado principalmente em micro-etapas (sub-atividades) criadas
-- pelo BreakActivityDialog, onde cada bloco da semana tem um prestador
-- responsável pela execução. ON DELETE SET NULL para preservar o histórico
-- da atividade caso o cadastro do fornecedor seja removido.
ALTER TABLE public.project_activities
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
    REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Índice para acelerar consultas "atividades por fornecedor" (calendário do
-- prestador, conflitos de agenda, relatórios).
CREATE INDEX IF NOT EXISTS idx_project_activities_fornecedor_id
  ON public.project_activities (fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

-- Atualiza o RPC replace_project_activities para também persistir o vínculo
-- com fornecedor quando enviado pelo cliente (mantém compatibilidade — o
-- campo é opcional). Não muda a assinatura nem a permissão.
CREATE OR REPLACE FUNCTION public.replace_project_activities(p_project_id uuid, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.project_activities where project_id = p_project_id;
  insert into public.project_activities (
    project_id, description, planned_start, planned_end,
    actual_start, actual_end, weight, sort_order, created_by,
    predecessor_ids, etapa, detailed_description, parent_activity_id,
    fornecedor_id
  )
  select
    p_project_id,
    (r->>'description')::text,
    (r->>'planned_start')::date,
    (r->>'planned_end')::date,
    nullif(r->>'actual_start','')::date,
    nullif(r->>'actual_end','')::date,
    (r->>'weight')::numeric,
    (r->>'sort_order')::int,
    (r->>'created_by')::uuid,
    coalesce(
      (select array_agg(elem::uuid) from jsonb_array_elements_text(coalesce(r->'predecessor_ids', '[]'::jsonb)) elem),
      '{}'::uuid[]
    ),
    nullif(r->>'etapa',''),
    nullif(btrim(r->>'detailed_description'),''),
    nullif(r->>'parent_activity_id','')::uuid,
    nullif(r->>'fornecedor_id','')::uuid
  from jsonb_array_elements(p_rows) r;
end;
$function$;