/**
 * Sem sinal NÃO é sessão expirada.
 *
 * Dentro da obra a rede cai o tempo todo. Se uma falha de rede fosse lida
 * como erro de autenticação, o tratamento global (src/lib/queryClient.ts)
 * deslogaria o mestre de obras no meio do apartamento — e a fila offline
 * (limpa no logout) iria junto. Aqui provamos que:
 *  - "Failed to fetch", o 503 fabricado pelo service worker e o teto de tempo
 *    dele não disparam a recuperação de sessão nem o logout;
 *  - token vencido enquanto está sem sinal (refresh falha por rede) também
 *    não desloga: o desfecho é "não deu para confirmar", não "sessão morta".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut: h.signOut, getSession: h.getSession, refreshSession: h.refreshSession },
  },
}));

import { queryClient } from "@/lib/queryClient";
import {
  __resetAuthRecoveryForTests,
  checkSessionForWrite,
  isConnectionFailure,
  isExpiredSessionError,
  SW_OFFLINE_CODE,
} from "@/lib/authRecovery";

/** Forma real do postgrest-js / repositório: objeto simples. */
const fetchFailure = { message: "TypeError: Failed to fetch", details: "", hint: "", code: "" };
const safariFailure = { message: "TypeError: Load failed", details: "", hint: "", code: "" };
/** O 503 que public/sw-cache.js devolve quando a rede não respondeu. */
const swOffline = Object.assign(new Error("Sem conexão com o servidor. Dados não disponíveis offline."), {
  code: SW_OFFLINE_CODE,
  details: "",
  hint: "",
  status: 503,
});
/** O teto de tempo do SW, se escapar como erro (AbortError). */
const swTimeout = new DOMException("The user aborted a request.", "AbortError");
const typeError = new TypeError("Failed to fetch");

const NETWORK_ERRORS: [string, unknown][] = [
  ["TypeError nativo", typeError],
  ["postgrest Failed to fetch", fetchFailure],
  ["Safari Load failed", safariFailure],
  ["503 do service worker (BWILD_OFFLINE)", swOffline],
  ["teto de tempo (AbortError)", swTimeout],
];

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetAuthRecoveryForTests();
  h.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

describe("falha de rede não é erro de sessão", () => {
  it.each(NETWORK_ERRORS)("%s: não é sessão expirada, é falha de conexão", (_n, err) => {
    expect(isExpiredSessionError(err)).toBe(false);
    expect(isConnectionFailure(err)).toBe(true);
  });

  it.each(NETWORK_ERRORS)("%s numa gravação: nada de logout nem renovação", async (_n, err) => {
    const m = queryClient.getMutationCache().build<unknown, unknown, unknown, unknown>(queryClient, {
      mutationFn: () => Promise.reject(err),
      retry: false,
    });
    await m.execute(undefined).catch(() => undefined);
    await flush();
    expect(h.refreshSession).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
    queryClient.getMutationCache().remove(m);
  });

  it.each(NETWORK_ERRORS)("%s numa leitura: nada de logout nem renovação", async (_n, err) => {
    await queryClient
      .fetchQuery({ queryKey: ["teste-offline", String(_n)], queryFn: () => Promise.reject(err), retry: false })
      .catch(() => undefined);
    await flush();
    expect(h.refreshSession).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("token vencido sem sinal: o 401 tenta renovar, a renovação falha por rede — NÃO desloga", async () => {
    const expired = { access_token: "t", expires_at: Math.floor(Date.now() / 1000) - 60, user: { id: "u1" } };
    h.getSession.mockResolvedValue({ data: { session: expired }, error: null });
    h.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 },
    });
    const m = queryClient.getMutationCache().build<unknown, unknown, unknown, unknown>(queryClient, {
      mutationFn: () => Promise.reject({ message: "JWT expired", code: "PGRST301", details: "", hint: "" }),
      retry: false,
    });
    await m.execute(undefined).catch(() => undefined);
    await flush(30);
    expect(h.refreshSession).toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
    queryClient.getMutationCache().remove(m);
  });

  it("antes de enviar a fila: token vencido + sem rede = esperar (não enviar com chave anônima)", async () => {
    const expired = { access_token: "t", expires_at: Math.floor(Date.now() / 1000) - 60, user: { id: "u1" } };
    h.getSession.mockResolvedValue({ data: { session: expired }, error: null });
    h.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 },
    });
    await expect(checkSessionForWrite()).resolves.toEqual({ outcome: "unknown", userId: "u1" });
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("supabase-js sem conseguir ler a sessão (refresh interno falhou por rede) = esperar", async () => {
    h.getSession.mockResolvedValue({ data: { session: null }, error: { message: "Failed to fetch" } });
    await expect(checkSessionForWrite()).resolves.toMatchObject({ outcome: "unknown" });
  });

  it("token válido: pode enviar, sem renovar", async () => {
    const ok = { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u1" } };
    h.getSession.mockResolvedValue({ data: { session: ok }, error: null });
    await expect(checkSessionForWrite()).resolves.toEqual({ outcome: "recovered", userId: "u1" });
    expect(h.refreshSession).not.toHaveBeenCalled();
  });
});
