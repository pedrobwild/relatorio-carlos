
create or replace function public.reorder_project_activities(
  p_project_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.project_activities
    where project_id = p_project_id
    limit 1
  ) then
    raise exception 'Projeto não encontrado ou sem acesso';
  end if;

  update public.project_activities a
    set sort_order = ord.idx
  from unnest(p_ordered_ids) with ordinality as ord(id, idx)
  where a.id = ord.id
    and a.project_id = p_project_id;
end;
$$;

grant execute on function public.reorder_project_activities(uuid, uuid[]) to authenticated;
