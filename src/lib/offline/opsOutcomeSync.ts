/**
 * Feito / Não feito sem sinal — a fila de envio da tela Hoje.
 *
 * Dentro do apartamento em obra muitas vezes não há sinal. A confirmação do
 * dia não pode depender disso: o toque vale na hora, fica guardado no
 * aparelho (inclusive se o app for fechado) e é enviado sozinho, em ordem,
 * quando a conexão volta.
 *
 * COMO FUNCIONA (padrão documentado do TanStack Query)
 * ---------------------------------------------------
 * - A mutação tem chave FIXA (`queryKeys.ops.setOutcomeMutation`) e a sua
 *   `mutationFn` é registrada com `setMutationDefaults` ANTES de o cache ser
 *   restaurado — é assim que uma mutação persistida reencontra o que fazer
 *   depois de recarregar a página.
 * - `networkMode: "online"`: sem rede, a mutação fica PAUSADA (não falha).
 * - Todas compartilham o `scope` → são enviadas uma de cada vez, na ordem.
 * - O provider persiste as mutações pendentes (`shouldDehydrateMutation`) e
 *   chama `resumePausedMutations()` ao restaurar.
 *
 * O "otimista" não grava no cache do dia: a tela aplica por cima dos dados do
 * servidor tudo o que ainda está na fila (`applyPendingOutcomes`). Assim:
 *  - depois de recarregar, o que estava na fila continua aparecendo;
 *  - um refetch no meio do caminho não "desmarca" o que a pessoa marcou;
 *  - se o envio for recusado, a mutação sai da fila e a tela volta sozinha ao
 *    que o servidor tem (o rollback) — e a falha vira aviso, nunca some.
 */
import { onlineManager, type Mutation, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  opsRepo,
  type OpsAssignment,
  type OpsAssignmentOutcome,
  type OpsBlockReason,
  type OpsDayAssignment,
} from "@/infra/repositories/ops.repository";
import {
  checkSessionForWrite,
  isBackendUnavailableError,
  isConnectionFailure,
  SW_OFFLINE_CODE,
} from "@/lib/authRecovery";
import { mapError } from "@/lib/errorMapping";

/**
 * Quanto tempo as leituras da operação ficam em memória sem ninguém olhando.
 * Tem que ser >= o `maxAge` do cache persistido (24 h): uma query recolhida
 * pelo GC deixa de ser gravada no aparelho, e o dia some do modo offline.
 */
export const OPS_OFFLINE_GC_TIME = 24 * 60 * 60 * 1000;

/** Uma fila só: os envios saem um de cada vez, na ordem em que foram feitos. */
export const OPS_OUTCOME_SCOPE = "ops-outcome";

export interface SetOutcomeVars {
  id: string;
  outcome: OpsAssignmentOutcome | null;
  reason?: OpsBlockReason | null;
  notes?: string | null;
  photoPaths?: string[];
  /** Título da atividade — só para o aviso caso o envio seja recusado. */
  label?: string;
}

export interface PendingOutcome {
  vars: SetOutcomeVars;
  /** Quando foi tocado (vira o "Feito às hh:mm" enquanto não sai). */
  submittedAt: number;
}

/** Aplica o Feito / Não feito numa lista do dia. */
export function applyOutcome(list: OpsDayAssignment[] | undefined, vars: SetOutcomeVars, now: string) {
  if (!list) return list;
  return list.map((a) =>
    a.id !== vars.id
      ? a
      : {
          ...a,
          outcome: vars.outcome,
          not_done_reason: vars.outcome === "nao_feito" ? (vars.reason ?? null) : null,
          // Desfazer limpa a observação do "Não feito" (igual ao repositório).
          notes: vars.notes !== undefined ? vars.notes : vars.outcome === null ? null : a.notes,
          done_at: vars.outcome ? now : null,
        },
  );
}

/**
 * O dia como a pessoa o deixou: dados do servidor + o que ainda está na fila,
 * na ordem. Para a mesma alocação vale o último toque.
 */
export function applyPendingOutcomes(
  list: OpsDayAssignment[] | undefined,
  pending: readonly PendingOutcome[],
): OpsDayAssignment[] | undefined {
  if (!list || pending.length === 0) return list;
  let out: OpsDayAssignment[] | undefined = list;
  for (const p of pending) {
    out = applyOutcome(out, p.vars, new Date(p.submittedAt || Date.now()).toISOString());
  }
  return out;
}

/** Junta a linha devolvida pelo banco na lista do dia (mantém as relações). */
export function mergeAssignmentRow(list: OpsDayAssignment[] | undefined, row: OpsAssignment | null | undefined) {
  if (!list || !row) return list;
  return list.map((a) => (a.id === row.id ? { ...a, ...row } : a));
}

/**
 * Qualquer escrita na operação invalida tudo de `ops` (contadores e rollup
 * dependem entre si) e também a tela Obras, que lê as mesmas tabelas com
 * outra chave — sem isso ela mostrava "semana não planejada" e alertas
 * antigos logo depois de planejar/confirmar.
 */
export function invalidateOps(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.obrasPanel.all });
  return qc.invalidateQueries({ queryKey: queryKeys.ops.all });
}

const OUTCOME_KEY = queryKeys.ops.setOutcomeMutation;

export function isOutcomeMutation(m: Pick<Mutation, "options">): boolean {
  const key = m.options.mutationKey;
  return (
    Array.isArray(key) && key.length === OUTCOME_KEY.length && OUTCOME_KEY.every((part, i) => key[i] === part)
  );
}

/**
 * O que vai para o aparelho: só mutações PENDENTES marcadas como da fila
 * offline. As demais (sem `mutationFn` registrada por chave) não teriam como
 * ser retomadas depois de recarregar e falhariam com "No mutationFn found".
 */
export function shouldPersistMutation(m: {
  options: { meta?: Record<string, unknown> };
  state: { status: string };
}): boolean {
  const meta = m.options.meta as { offlineQueue?: boolean } | undefined;
  return meta?.offlineQueue === true && m.state.status === "pending";
}

/**
 * Último toque vale: tira da fila os envios da mesma alocação que ainda NÃO
 * saíram (pausados). Um que já está a caminho não pode ser cancelado — o novo
 * entra atrás dele na fila e chega depois, então o resultado final é o mesmo.
 * Devolve quantos foram descartados.
 */
export function collapseQueuedOutcomes(qc: QueryClient, assignmentId: string): number {
  const cache = qc.getMutationCache();
  const stale = cache
    .getAll()
    .filter(
      (m) =>
        isOutcomeMutation(m) &&
        m.state.status === "pending" &&
        m.state.isPaused &&
        (m.state.variables as SetOutcomeVars | undefined)?.id === assignmentId,
    );
  for (const m of stale) cache.remove(m);
  return stale.length;
}

/**
 * Falha que vale esperar e repetir: a requisição não saiu do aparelho (ou o
 * servidor está temporariamente fora). O registro NÃO pode ser descartado.
 */
export function isRetryableSyncError(err: unknown): boolean {
  return isConnectionFailure(err) || isBackendUnavailableError(err);
}

function offlineError(): Error {
  return Object.assign(new Error("Sem conexão: envio adiado até o sinal voltar."), {
    code: SW_OFFLINE_CODE,
  });
}

/** Envia um Feito / Não feito / desfazer, conferindo a sessão antes. */
export async function sendOutcome(vars: SetOutcomeVars): Promise<OpsAssignment> {
  const { outcome } = await checkSessionForWrite();
  // Não deu para confirmar a sessão (sem rede): espera, não desloga.
  if (outcome === "unknown") throw offlineError();
  if (outcome === "rejected") {
    // Mesma forma de um 401 do PostgREST: o tratamento global tenta renovar
    // e só desloga se o servidor recusar de fato.
    throw Object.assign(new Error("JWT expired"), { status: 401 });
  }
  const res = await opsRepo.setOutcome(vars.id, vars.outcome, {
    reason: vars.reason,
    notes: vars.notes,
    photoPaths: vars.photoPaths,
  });
  if (res.error) throw res.error;
  return res.data as OpsAssignment;
}

// ---------------------------------------------------------------------------
// Falhas de envio — ficam visíveis até a pessoa dispensar
// ---------------------------------------------------------------------------

export interface SyncFailure {
  key: string;
  assignmentId: string;
  label: string;
  /** "Feito" / "Não feito" / "Desfazer" / "Foto". */
  action: string;
  message: string;
  at: number;
}

const OUTCOME_ACTION: Record<string, string> = { feito: "Feito", nao_feito: "Não feito", null: "Desfazer" };

export function outcomeActionLabel(outcome: OpsAssignmentOutcome | null | undefined): string {
  return OUTCOME_ACTION[String(outcome ?? null)] ?? "Registro";
}

let failures: SyncFailure[] = [];
const failureListeners = new Set<() => void>();

export const syncFailures = {
  subscribe(listener: () => void) {
    failureListeners.add(listener);
    return () => {
      failureListeners.delete(listener);
    };
  },
  getSnapshot(): readonly SyncFailure[] {
    return failures;
  },
  add(f: Omit<SyncFailure, "key" | "at">) {
    failures = [...failures, { ...f, at: Date.now(), key: `${f.assignmentId}-${Date.now()}-${failures.length}` }];
    failureListeners.forEach((l) => l());
  },
  dismiss(key: string) {
    failures = failures.filter((f) => f.key !== key);
    failureListeners.forEach((l) => l());
  },
  clear() {
    failures = [];
    failureListeners.forEach((l) => l());
  },
};

/** Recusa de envio (RLS, alocação apagada, regra do banco): avisa, não engole. */
export function reportOutcomeFailure(err: unknown, vars: SetOutcomeVars | undefined) {
  const label = vars?.label?.trim() || "Atividade";
  const action = outcomeActionLabel(vars?.outcome);
  const message = mapError(err).userMessage;
  syncFailures.add({ assignmentId: vars?.id ?? "", label, action, message });
  toast.error(`Não foi possível enviar "${action}" de ${label}`, { description: message });
}

// ---------------------------------------------------------------------------
// Registro no QueryClient (chamar ANTES de restaurar o cache persistido)
// ---------------------------------------------------------------------------

/**
 * O TanStack começa achando que está online e só escuta os eventos
 * `online`/`offline` dali em diante. Aberto já sem sinal, ele tentaria enviar
 * e buscar tudo — e falharia — em vez de pausar.
 */
export function syncOnlineManagerWithNavigator() {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    onlineManager.setOnline(navigator.onLine);
  }
}

export function registerOpsOfflineDefaults(qc: QueryClient) {
  qc.setQueryDefaults(queryKeys.ops.all, { gcTime: OPS_OFFLINE_GC_TIME });

  qc.setMutationDefaults(OUTCOME_KEY, {
    mutationFn: (vars: unknown) => sendOutcome(vars as SetOutcomeVars),
    scope: { id: OPS_OUTCOME_SCOPE },
    networkMode: "online",
    // Falha de alcance: tenta de novo sem limite (sem rede, o TanStack pausa
    // entre as tentativas). Recusa do servidor: não repete — vira aviso.
    retry: (_count: number, err: unknown) => isRetryableSyncError(err),
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
    meta: { offlineQueue: true },
    onSuccess: (row: unknown) => {
      for (const [key, list] of qc.getQueriesData<OpsDayAssignment[]>({
        queryKey: [...queryKeys.ops.all, "day"],
      })) {
        qc.setQueryData(key, mergeAssignmentRow(list, row as OpsAssignment));
      }
    },
    onError: (err: unknown, vars: unknown) => reportOutcomeFailure(err, vars as SetOutcomeVars),
    onSettled: () => {
      // Com a fila andando, invalida uma vez só, no último envio.
      if (qc.isMutating({ mutationKey: OUTCOME_KEY }) <= 1) void invalidateOps(qc);
    },
  });
}
