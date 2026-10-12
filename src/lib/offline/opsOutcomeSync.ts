/**
 * Feito / Não feito sem sinal — a fila de envio da tela Hoje.
 *
 * Dentro do apartamento em obra muitas vezes não há sinal. A confirmação do
 * dia não pode depender disso: o toque vale na hora, fica guardado no
 * aparelho (inclusive se o app for fechado) e é enviado sozinho, em ordem,
 * quando a conexão volta.
 *
 * COMO FUNCIONA
 * -------------
 * - Cada toque vira uma entrada na CAIXA DE SAÍDA (`outcomeOutbox.ts`):
 *   armazenamento próprio (IndexedDB), por usuário, sem validade. NÃO fica no
 *   cache das consultas, que pode ser descartado (24 h, versão nova, cota).
 * - O envio é uma mutação do TanStack com chave FIXA
 *   (`queryKeys.ops.setOutcomeMutation`) e defaults registrados com
 *   `setMutationDefaults`; as variáveis carregam o `outboxId` da entrada.
 *   `networkMode: "online"`: sem rede, a mutação fica PAUSADA (não falha).
 *   Todas compartilham o `scope` → saem uma de cada vez, na ordem.
 * - O banco confirmou (ou recusou de vez) → a entrada sai da caixa.
 * - Ao abrir o app (ou entrar de novo), `restoreQueuedOutcomes` recria, na
 *   ordem, uma mutação para cada entrada daquele usuário que ainda não tem
 *   uma em andamento. As mutações NÃO vão para o cache persistido (o
 *   persister descarta), então cada registro tem uma origem só e não é
 *   enviado duas vezes.
 *
 * O "otimista" não grava no cache do dia: a tela aplica por cima dos dados do
 * servidor tudo o que ainda está na fila (`applyPendingOutcomes`). Assim:
 *  - depois de recarregar, o que estava na fila continua aparecendo;
 *  - um refetch no meio do caminho não "desmarca" o que a pessoa marcou;
 *  - se o envio for recusado, a mutação sai da fila e a tela volta sozinha ao
 *    que o servidor tem (o rollback) — e a falha vira aviso, nunca some.
 */
import { MutationObserver, onlineManager, type Mutation, type QueryClient } from "@tanstack/react-query";
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
import { createDefaultOutboxStorage, createOutbox, type Outbox, type OutboxEntry } from "./outcomeOutbox";

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
  /** Entrada correspondente na caixa de saída (preenchido pela fila). */
  outboxId?: string;
  /** Quem tocou: só a mesma conta envia. */
  userId?: string;
  /** Quando foi tocado (sobrevive à reabertura do app). */
  queuedAt?: number;
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

// ---------------------------------------------------------------------------
// Caixa de saída (armazenamento próprio, por usuário)
// ---------------------------------------------------------------------------

let outbox: Outbox<SetOutcomeVars> = createOutbox<SetOutcomeVars>(createDefaultOutboxStorage<SetOutcomeVars>());
let outboxUser: string | null = null;
/** Entradas cujo envio está saindo agora (a requisição está no ar). */
const sending = new Set<string>();

export function getOutcomeOutbox(): Outbox<SetOutcomeVars> {
  return outbox;
}

/** Somente para testes: troca a caixa (ex.: armazenamento em memória). */
export function __setOutcomeOutboxForTests(next: Outbox<SetOutcomeVars>, user: string | null = null) {
  outbox = next;
  outboxUser = user;
  sending.clear();
}

/** Conta logada agora (mantida pela sessão offline; ver opsOfflineSession). */
export function setOutboxUser(userId: string | null) {
  outboxUser = userId;
}

export function getOutboxUser(): string | null {
  return outboxUser;
}

function varsOf(e: OutboxEntry<SetOutcomeVars>): SetOutcomeVars {
  return { ...e.vars, outboxId: e.id, userId: e.userId, queuedAt: e.queuedAt };
}

function outcomeMutations(qc: QueryClient) {
  return qc
    .getMutationCache()
    .getAll()
    .filter((m) => isOutcomeMutation(m) && m.state.status === "pending");
}

/** A entrada já tem uma mutação viva (na fila ou saindo)? */
function hasLiveMutation(qc: QueryClient, outboxId: string): boolean {
  if (sending.has(outboxId)) return true;
  return outcomeMutations(qc).some((m) => (m.state.variables as SetOutcomeVars | undefined)?.outboxId === outboxId);
}

function runOutcome(qc: QueryClient, vars: SetOutcomeVars) {
  const obs = new MutationObserver<OpsAssignment, unknown, SetOutcomeVars>(qc, { mutationKey: OUTCOME_KEY });
  obs.mutate(vars).catch(() => undefined);
}

/**
 * Último toque vale: tira da fila os envios da mesma alocação que ainda NÃO
 * saíram (pausados) — da memória e da caixa de saída. Um que já está a
 * caminho não pode ser cancelado — o novo entra atrás dele na fila e chega
 * depois, então o resultado final é o mesmo. Devolve quantos foram
 * descartados.
 */
export function collapseQueuedOutcomes(qc: QueryClient, assignmentId: string): number {
  const cache = qc.getMutationCache();
  const stale = outcomeMutations(qc).filter(
    (m) => m.state.isPaused && (m.state.variables as SetOutcomeVars | undefined)?.id === assignmentId,
  );
  const ids: string[] = [];
  for (const m of stale) {
    const id = (m.state.variables as SetOutcomeVars | undefined)?.outboxId;
    if (id) ids.push(id);
    cache.remove(m);
  }
  // Entradas guardadas que ainda não viraram mutação (ex.: recusadas por
  // sessão e à espera de entrar de novo) também perdem para o toque novo.
  if (outboxUser) {
    for (const e of outbox.forUser(outboxUser)) {
      if (e.vars.id === assignmentId && !ids.includes(e.id) && !hasLiveMutation(qc, e.id)) ids.push(e.id);
    }
  }
  outbox.remove(ids);
  return stale.length;
}

/**
 * Um toque: guarda na caixa de saída (se a conta é conhecida) e enfileira o
 * envio. `run` é o `mutate` do hook (para o componente acompanhar o estado);
 * sem ele, cria a mutação direto no cliente.
 */
export function enqueueOutcome(
  qc: QueryClient,
  vars: SetOutcomeVars,
  run: (vars: SetOutcomeVars) => void = (v) => runOutcome(qc, v),
): SetOutcomeVars {
  collapseQueuedOutcomes(qc, vars.id);
  const userId = vars.userId ?? outboxUser;
  let full: SetOutcomeVars = { ...vars, queuedAt: vars.queuedAt ?? Date.now() };
  if (userId) {
    const { outboxId: _o, userId: _u, queuedAt: _q, ...plain } = vars;
    const entry = outbox.add(userId, plain);
    full = varsOf(entry);
  } else {
    console.warn("[FilaOffline] Sem usuário conhecido: o registro não fica guardado no aparelho.");
  }
  run(full);
  return full;
}

/**
 * Abre o app / entra de novo: recria, na ordem, o envio de cada entrada desta
 * conta que ainda não tem mutação viva. Pode ser chamado quantas vezes for
 * preciso — não duplica. Devolve quantas foram retomadas.
 */
export function restoreQueuedOutcomes(qc: QueryClient, userId: string): number {
  let n = 0;
  for (const e of outbox.forUser(userId)) {
    if (hasLiveMutation(qc, e.id)) continue;
    runOutcome(qc, varsOf(e));
    n += 1;
  }
  return n;
}

/**
 * "Sair mesmo assim": apaga desta conta o que não foi enviado (caixa de
 * saída + mutações paradas na memória). Devolve quantos registros.
 */
export function discardQueuedOutcomes(qc: QueryClient, userId: string): number {
  const cache = qc.getMutationCache();
  for (const m of outcomeMutations(qc)) {
    const v = m.state.variables as SetOutcomeVars | undefined;
    if (m.state.isPaused && (v?.userId === userId || !v?.userId)) cache.remove(m);
  }
  return outbox.discardUser(userId);
}

/**
 * Erro que NÃO descarta a entrada: a sessão não é desta conta (outra pessoa
 * entrou no aparelho) ou não há sessão. A entrada fica guardada e é enviada
 * quando a conta dona entrar de novo.
 */
export class OutboxHoldError extends Error {
  readonly holdInOutbox = true;
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OutboxHoldError";
  }
}

export function isOutboxHold(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { holdInOutbox?: boolean }).holdInOutbox === true;
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
  const { outcome, userId } = await checkSessionForWrite();
  // Não deu para confirmar a sessão (sem rede): espera, não desloga.
  if (outcome === "unknown") throw offlineError();
  if (outcome === "rejected") {
    // Mesma forma de um 401 do PostgREST: o tratamento global tenta renovar
    // e só desloga se o servidor recusar de fato. O registro continua
    // guardado e sai quando a pessoa entrar de novo.
    throw new OutboxHoldError("JWT expired", 401);
  }
  if (vars.userId && userId && userId !== vars.userId) {
    throw new OutboxHoldError("Registro de outra conta: aguarda a conta dona entrar.");
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
    mutationFn: async (raw: unknown) => {
      const vars = raw as SetOutcomeVars;
      const id = vars.outboxId;
      if (id) sending.add(id);
      try {
        return await sendOutcome(vars);
      } finally {
        if (id) sending.delete(id);
      }
    },
    scope: { id: OPS_OUTCOME_SCOPE },
    networkMode: "online",
    // Falha de alcance: tenta de novo sem limite (sem rede, o TanStack pausa
    // entre as tentativas). Recusa do servidor: não repete — vira aviso.
    retry: (_count: number, err: unknown) => isRetryableSyncError(err),
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
    meta: { offlineQueue: true },
    onSuccess: (row: unknown, raw: unknown) => {
      const vars = raw as SetOutcomeVars;
      if (vars?.outboxId) outbox.remove([vars.outboxId]);
      for (const [key, list] of qc.getQueriesData<OpsDayAssignment[]>({
        queryKey: [...queryKeys.ops.all, "day"],
      })) {
        qc.setQueryData(key, mergeAssignmentRow(list, row as OpsAssignment));
      }
    },
    onError: (err: unknown, raw: unknown) => {
      const vars = raw as SetOutcomeVars;
      // Sessão de outra conta / sem sessão: continua guardado, sem aviso.
      if (isOutboxHold(err)) return;
      if (vars?.outboxId) outbox.remove([vars.outboxId]);
      reportOutcomeFailure(err, vars);
    },
    onSettled: () => {
      // Com a fila andando, invalida uma vez só, no último envio.
      if (qc.isMutating({ mutationKey: OUTCOME_KEY }) <= 1) void invalidateOps(qc);
    },
  });
}
