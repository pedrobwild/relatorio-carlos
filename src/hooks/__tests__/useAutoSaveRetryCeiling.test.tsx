/**
 * Regressão do incidente de 29-30/08.
 *
 * A fila de autosave tinha um limite de 3 tentativas — mas o handler de
 * `online` zerava o contador. Em rede instável de obra (celular alternando
 * entre 4G e Wi-Fi), o evento `online` dispara sem parar: o limite nunca era
 * alcançado e o app martelava `save_weekly_report` indefinidamente. Isso
 * manteve o pool de conexões do PostgREST saturado por 27h, até ele não
 * conseguir nem recarregar o próprio schema cache e passar a responder 503
 * em TODA requisição REST — derrubando o portal inteiro.
 *
 * Os testes abaixo travam as três garantias que impedem a repetição:
 *   1. existe um teto absoluto que eventos automáticos não furam;
 *   2. voltar a conexão NÃO devolve orçamento de tentativas;
 *   3. o usuário, explicitamente, ainda consegue tentar de novo.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "@/hooks/useAutoSave";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

/** Dispara N ciclos de online/offline, como uma rede instável faria. */
async function flapNetwork(times: number) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      setOnline(false);
      setOnline(true);
      vi.advanceTimersByTime(200_000);
    });
  }
}

describe("useAutoSave — teto de retentativas", () => {
  beforeEach(() => {
    localStorage.clear();
    setOnline(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("para de tentar sozinho mesmo com a rede oscilando sem parar", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("falha de gravação"));

    const { rerender } = renderHook(
      ({ data }) =>
        useAutoSave({ data, onSave, debounceMs: 10, offlineKey: "ceiling" }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    rerender({ data: { texto: "editado" } });
    await act(async () => {
      vi.advanceTimersByTime(200_000);
    });

    await flapNetwork(20);

    // Sem o teto, cada `online` devolvia orçamento e isto crescia sem limite.
    // O valor exato depende do escalonamento; o que importa é que fique
    // MUITO abaixo do número de oscilações e não cresça indefinidamente.
    expect(onSave.mock.calls.length).toBeLessThanOrEqual(10);

    const afterFlapping = onSave.mock.calls.length;
    await flapNetwork(20);
    expect(onSave.mock.calls.length).toBe(afterFlapping);
  });

  it("o usuário ainda consegue forçar uma nova tentativa depois do teto", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("falha de gravação"));

    const { rerender, result } = renderHook(
      ({ data }) =>
        useAutoSave({ data, onSave, debounceMs: 10, offlineKey: "ceiling-2" }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    rerender({ data: { texto: "editado" } });
    await act(async () => {
      vi.advanceTimersByTime(200_000);
    });
    await flapNetwork(20);

    const exhausted = onSave.mock.calls.length;

    // Ação explícita de uma pessoa é a única porta que devolve orçamento.
    await act(async () => {
      result.current.saveNow();
      vi.advanceTimersByTime(1000);
    });

    expect(onSave.mock.calls.length).toBeGreaterThan(exhausted);
  });

  it("uma gravação bem-sucedida devolve o orçamento por completo", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ data }) =>
        useAutoSave({ data, onSave, debounceMs: 10, offlineKey: "ceiling-3" }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    rerender({ data: { texto: "editado" } });
    // O retry é agendado só depois que a promise da tentativa anterior
    // resolve, então é preciso alternar avanço de timer com flush de
    // microtasks em vez de um único salto grande.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
    }

    expect(onSave.mock.calls.length).toBeGreaterThan(1);

    // Depois do sucesso, uma nova edição deve poder salvar normalmente —
    // o teto não pode ficar "grudado" de falhas antigas.
    const beforeNewEdit = onSave.mock.calls.length;
    rerender({ data: { texto: "outra edição" } });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
    }

    expect(onSave.mock.calls.length).toBeGreaterThan(beforeNewEdit);
  });

  it("o teto vale na ENTRADA: novas mudanças de dado não o furam", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("falha de gravação"));

    const { rerender } = renderHook(
      ({ data }) =>
        useAutoSave({ data, onSave, debounceMs: 10, offlineKey: "ceiling-4" }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    rerender({ data: { texto: "editado" } });
    await act(async () => {
      vi.advanceTimersByTime(200_000);
    });
    await flapNetwork(20);
    const exhausted = onSave.mock.calls.length;

    // Regressão de 04/09: o teto só existia em `scheduleRetry`. O debounce,
    // a troca de aba e o desmonte chamam `performSave` direto — e cada
    // chamada rendia mais uma tentativa. Com o dado mudando (teclado,
    // sincronização, re-render), era um laço sem fim contra o servidor.
    for (let i = 0; i < 15; i++) {
      rerender({ data: { texto: `edição ${i}` } });
      await act(async () => {
        vi.advanceTimersByTime(5_000);
      });
    }
    expect(onSave.mock.calls.length).toBe(exhausted);

    // Trocar de aba também não fura.
    await act(async () => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5_000);
    });
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    expect(onSave.mock.calls.length).toBe(exhausted);
  });

  it("erro PERMANENTE não é retentado sozinho — só uma pessoa destrava", async () => {
    // Forma real: corpo do PostgREST + status anexado ao Error lançado.
    const conflito = Object.assign(new Error("WEEKLY_REPORT_CONFLICT"), {
      code: "40001",
      details: "",
      hint: "",
      status: 500,
    });
    const onSave = vi.fn().mockRejectedValue(conflito);

    const { rerender, result } = renderHook(
      ({ data }) =>
        useAutoSave({ data, onSave, debounceMs: 10, offlineKey: "ceiling-5" }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    rerender({ data: { texto: "editado" } });
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
    }

    // Antes: 40001 chega como HTTP 500, passava por instabilidade e entrava
    // no backoff (5s, 15s, 45s) repetindo o MESMO carimbo — inútil.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");

    await act(async () => {
      result.current.saveNow();
      vi.advanceTimersByTime(1_000);
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
