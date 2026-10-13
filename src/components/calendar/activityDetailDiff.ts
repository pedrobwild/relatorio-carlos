/**
 * O que mudou no diálogo de detalhes do Calendário em relação aos valores
 * com que ele abriu. Só esses campos são gravados: o diálogo nunca manda um
 * campo que a pessoa não mexeu (ex.: mudar só o término não pode apagar o
 * início do cronograma do cliente, que pode estar diferente do interno).
 */
export interface ActivityDetailValues {
  actual_start: string | null;
  actual_end: string | null;
  responsible_user_id: string | null;
}

export function changedDetailFields(
  opened: ActivityDetailValues,
  next: ActivityDetailValues,
): Partial<ActivityDetailValues> {
  const out: Partial<ActivityDetailValues> = {};
  for (const k of ["actual_start", "actual_end", "responsible_user_id"] as const) {
    if ((next[k] ?? null) !== (opened[k] ?? null)) out[k] = next[k] ?? null;
  }
  return out;
}
