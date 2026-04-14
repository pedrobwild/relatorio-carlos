
create or replace function public.save_project_baseline(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_activities
  set
    baseline_start = planned_start,
    baseline_end = planned_end,
    baseline_saved_at = now()
  where project_id = p_project_id;
end;
$$;

grant execute on function public.save_project_baseline(uuid) to authenticated;
