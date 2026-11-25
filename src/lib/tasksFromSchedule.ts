/**
 * Atividades internas a partir do cronograma interno da obra.
 *
 * O cronograma já traz, por semana/etapa, cada item a ser executado. Aqui
 * transformamos esses itens em candidatas a atividade (aba Atividades), para
 * a equipe não redigitar o escopo: título = item, datas = previsto do item.
 * Função pura — a tela decide o que marcar e o hook grava.
 */

export interface ScheduleItemForTasks {
  id: string;
  parent_id: string | null;
  description: string;
  etapa: string | null;
  planned_start: string;
  planned_end: string;
  actual_end: string | null;
  responsible_user_id: string | null;
  notes: string | null;
  sort_order: number;
}

export interface TaskCandidate {
  /** id do item do cronograma de origem. */
  sourceId: string;
  title: string;
  /** Semana/etapa a que o item pertence — usada para agrupar a lista. */
  group: string;
  start_date: string;
  due_date: string;
  responsible_user_id: string | null;
  notes: string | null;
  /** Item já concluído no cronograma. */
  done: boolean;
  /** Já existe atividade com o mesmo título nesta obra. */
  alreadyExists: boolean;
}

export const normalizeTaskTitle = (title: string): string =>
  title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/**
 * Candidatas = itens-folha do cronograma (o item a executar). Etapas/semanas
 * que têm filhos viram apenas o nome do grupo; sem detalhamento, a própria
 * etapa é a candidata.
 */
export function buildTaskCandidates(
  items: readonly ScheduleItemForTasks[],
  existingTitles: readonly string[],
): TaskCandidate[] {
  const existing = new Set(existingTitles.map(normalizeTaskTitle));
  const byId = new Map(items.map((i) => [i.id, i]));
  const parentIds = new Set(
    items.map((i) => i.parent_id).filter((id): id is string => !!id),
  );
  const orderOf = (i: ScheduleItemForTasks) => {
    const parent = i.parent_id ? byId.get(i.parent_id) : undefined;
    return [parent ? parent.sort_order : i.sort_order, parent ? i.sort_order : -1];
  };

  const seen = new Set<string>();
  return items
    .filter((i) => !parentIds.has(i.id) && i.description.trim())
    .slice()
    .sort((a, b) => {
      const [a1, a2] = orderOf(a);
      const [b1, b2] = orderOf(b);
      return a1 - b1 || a2 - b2 || a.planned_start.localeCompare(b.planned_start);
    })
    .flatMap((i) => {
      const key = normalizeTaskTitle(i.description);
      // Item repetido no próprio cronograma entra uma vez só.
      if (seen.has(key)) return [];
      seen.add(key);
      const parent = i.parent_id ? byId.get(i.parent_id) : undefined;
      return [
        {
          sourceId: i.id,
          title: i.description.trim(),
          group: parent?.description?.trim() || i.etapa?.trim() || "Sem etapa",
          start_date: i.planned_start,
          due_date: i.planned_end,
          responsible_user_id: i.responsible_user_id,
          notes: i.notes,
          done: !!i.actual_end,
          alreadyExists: existing.has(key),
        },
      ];
    });
}
