/**
 * Advanced filter types for the portfolio command center.
 * Shared between filter UI, page state, and filter application logic.
 */

export interface AdvancedFilters {
  status: string[]; // 'active' | 'completed' | 'paused' | 'cancelled'
  phase: string[]; // 'project' | 'execution'
  engineers: string[]; // engineer_user_id values
  customers: string[]; // customer_name values
  cities: string[]; // cidade values
  units: string[]; // unit_name values
  health: string[]; // 'excellent' | 'good' | 'attention' | 'critical'
  hasPendingDocs: boolean | null;
  hasPendingSign: boolean | null;
  criticality: string[]; // 'overdue' | 'blocked' | 'stale'
  dateRange: { from: string | null; to: string | null };
  contractMin: number | null;
  contractMax: number | null;
}

export const emptyFilters: AdvancedFilters = {
  status: [],
  phase: [],
  engineers: [],
  customers: [],
  cities: [],
  units: [],
  health: [],
  hasPendingDocs: null,
  hasPendingSign: null,
  criticality: [],
  dateRange: { from: null, to: null },
  contractMin: null,
  contractMax: null,
};

export function isFiltersEmpty(f: AdvancedFilters): boolean {
  return (
    f.status.length === 0 &&
    f.phase.length === 0 &&
    f.engineers.length === 0 &&
    f.customers.length === 0 &&
    f.cities.length === 0 &&
    f.units.length === 0 &&
    f.health.length === 0 &&
    f.hasPendingDocs === null &&
    f.hasPendingSign === null &&
    f.criticality.length === 0 &&
    f.dateRange.from === null &&
    f.dateRange.to === null &&
    f.contractMin === null &&
    f.contractMax === null
  );
}

/** Human-readable chip labels for active filters */
export function getActiveFilterChips(
  f: AdvancedFilters,
): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];

  const statusLabels: Record<string, string> = {
    active: "Em andamento",
    completed: "Concluída",
    paused: "Pausada",
    cancelled: "Cancelada",
  };
  for (const s of f.status)
    chips.push({ key: `status-${s}`, label: statusLabels[s] ?? s });

  const phaseLabels: Record<string, string> = {
    project: "Fase Projeto",
    execution: "Execução",
  };
  for (const p of f.phase)
    chips.push({ key: `phase-${p}`, label: phaseLabels[p] ?? p });

  for (const e of f.engineers)
    chips.push({ key: `eng-${e}`, label: `Eng: ${e}` });
  for (const c of f.customers)
    chips.push({ key: `cust-${c}`, label: `Cliente: ${c}` });
  for (const c of f.cities) chips.push({ key: `city-${c}`, label: c });
  for (const u of f.units) chips.push({ key: `unit-${u}`, label: `Un: ${u}` });

  const healthLabels: Record<string, string> = {
    excellent: "Excelente",
    good: "Bom",
    attention: "Atenção",
    critical: "Crítico",
  };
  for (const h of f.health)
    chips.push({ key: `health-${h}`, label: `Saúde: ${healthLabels[h]}` });

  if (f.hasPendingDocs === true)
    chips.push({ key: "docs", label: "Docs pendentes" });
  if (f.hasPendingSign === true)
    chips.push({ key: "sign", label: "Assinatura pendente" });

  const critLabels: Record<string, string> = {
    overdue: "Com atraso",
    blocked: "Bloqueada",
    stale: "Sem atualização",
  };
  for (const c of f.criticality)
    chips.push({ key: `crit-${c}`, label: critLabels[c] ?? c });

  if (f.dateRange.from || f.dateRange.to) {
    const from = f.dateRange.from ?? "…";
    const to = f.dateRange.to ?? "…";
    chips.push({ key: "date", label: `Período: ${from} – ${to}` });
  }

  if (f.contractMin !== null || f.contractMax !== null) {
    const min =
      f.contractMin !== null ? `R$${(f.contractMin / 1000).toFixed(0)}k` : "…";
    const max =
      f.contractMax !== null ? `R$${(f.contractMax / 1000).toFixed(0)}k` : "…";
    chips.push({ key: "financial", label: `Contrato: ${min} – ${max}` });
  }

  return chips;
}

/** Remove a single chip from filters by key */
export function removeFilterChip(
  f: AdvancedFilters,
  chipKey: string,
): AdvancedFilters {
  const next = { ...f };
  if (chipKey.startsWith("status-"))
    next.status = f.status.filter((s) => `status-${s}` !== chipKey);
  else if (chipKey.startsWith("phase-"))
    next.phase = f.phase.filter((s) => `phase-${s}` !== chipKey);
  else if (chipKey.startsWith("eng-"))
    next.engineers = f.engineers.filter((s) => `eng-${s}` !== chipKey);
  else if (chipKey.startsWith("cust-"))
    next.customers = f.customers.filter((s) => `cust-${s}` !== chipKey);
  else if (chipKey.startsWith("city-"))
    next.cities = f.cities.filter((s) => `city-${s}` !== chipKey);
  else if (chipKey.startsWith("unit-"))
    next.units = f.units.filter((s) => `unit-${s}` !== chipKey);
  else if (chipKey.startsWith("health-"))
    next.health = f.health.filter((s) => `health-${s}` !== chipKey);
  else if (chipKey === "docs") next.hasPendingDocs = null;
  else if (chipKey === "sign") next.hasPendingSign = null;
  else if (chipKey.startsWith("crit-"))
    next.criticality = f.criticality.filter((s) => `crit-${s}` !== chipKey);
  else if (chipKey === "date") next.dateRange = { from: null, to: null };
  else if (chipKey === "financial") {
    next.contractMin = null;
    next.contractMax = null;
  }
  return next;
}
