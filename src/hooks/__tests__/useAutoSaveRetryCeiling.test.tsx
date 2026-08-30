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
});
