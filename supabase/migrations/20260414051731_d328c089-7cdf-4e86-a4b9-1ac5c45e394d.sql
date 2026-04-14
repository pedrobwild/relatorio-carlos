
create or replace function public.replace_project_activities(
  p_project_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_activities where project_id = p_project_id;
  insert into public.project_activities (
    project_id, description, planned_start, planned_end,
    actual_start, actual_end, weight, sort_order, created_by,
    predecessor_ids, etapa, detailed_description
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
    nullif(btrim(r->>'detailed_description'),'')
  from jsonb_array_elements(p_rows) r;
end;
$$;

grant execute on function public.replace_project_activities(uuid, jsonb) to authenticated;
