/**
 * Helpers para a memória stateful do projeto.
 *
 * O estado segue a spec (state_memory): cada chave de seção
 * (project_context, technical_scope, ...) é um objeto. O agente devolve um
 * patch parcial e fazemos merge raso em cada seção: se o patch traz uma
 * chave de seção, ela substitui inteiramente a anterior. Isso é simples,
 * previsível e fácil de auditar.
 */

export type ProjectState = Record<string, Record<string, unknown>>;

const KNOWN_SECTIONS = [
  'project_context',
  'technical_scope',
  'design_status',
  'schedule_state',
  'financial_state',
  'procurement_state',
  'execution_state',
  'quality_state',
  'communication_state',
] as const;

export type StateSection = typeof KNOWN_SECTIONS[number];

export function emptyState(): ProjectState {
  return {};
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Aplica patch parcial sobre o estado atual.
 * Política: substituição por seção (não merge profundo).
 * - Se patch traz `schedule_state`, ele substitui inteiramente o anterior.
 * - Chaves não conhecidas são ignoradas (defesa contra LLM "criativa").
 */
export function applyStatePatch(
  current: ProjectState,
  patch: unknown,
): { next: ProjectState; diff: Record<string, unknown> } {
  if (!isPlainObject(patch)) return { next: current, diff: {} };

  const next: ProjectState = { ...current };
  const diff: Record<string, unknown> = {};

  for (const key of Object.keys(patch)) {
    if (!KNOWN_SECTIONS.includes(key as StateSection)) continue;
    const value = patch[key];
    if (!isPlainObject(value)) continue;
    next[key] = value;
    diff[key] = value;
  }

  return { next, diff };
}

/**
 * Renderiza o estado atual para o system prompt do agente.
 * Mantém compacto — apenas seções não vazias.
 */
export function renderStateForPrompt(state: ProjectState): string {
  const sections: string[] = [];
  for (const key of KNOWN_SECTIONS) {
    const value = state[key];
    if (!value || (isPlainObject(value) && Object.keys(value).length === 0)) continue;
    sections.push(`### ${key}\n${JSON.stringify(value, null, 2)}`);
  }
  if (sections.length === 0) {
    return '_(memória vazia — projeto sem histórico ainda)_';
  }
  return sections.join('\n\n');
}
