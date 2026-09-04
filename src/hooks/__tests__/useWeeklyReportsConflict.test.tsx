/**
 * Regressão de 04/09/2026 — o carimbo congelado.
 *
 * Uma aba mandou `p_expected_updated_at` IDÊNTICO por horas, a centenas de
 * chamadas por segundo, e derrubou o portal. Dois defeitos deste hook
 * permitiam isso:
 *  1. o refetch disparado pelo conflito era cancelado pelo `onMutate` da
 *     tentativa seguinte, e o carimbo velho nunca era substituído;
 *  2. o cache podia devolver uma linha MAIS VELHA que a resposta da última
 *     gravação e ela sobrescrevia o carimbo bom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { WeeklyReportData } from "@/types/weeklyReport";
import { queryKeys } from "@/lib/queryKeys";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/lib/devLogger", () => ({
  reportLogger: { start: vi.fn(), end: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/hooks/useReportImageUpload", () => ({
  useReportImageUpload: () => ({
    uploadGalleryPhotos: vi.fn(),
    isUploading: false,
  }),
}));

// O que o SELECT de weekly_reports devolve — mutável por teste.
let serverRows: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      // Resolve num macrotask, como uma resposta de rede: é isso que abre
      // a janela em que o `onMutate` seguinte cancela o refetch do conflito.
      order: vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: serverRows, error: null }), 0),
          ),
      ),
    })),
  },
}));

const saveWeeklyReport = vi.fn();
vi.mock("@/infra/repositories/weeklyReports.repository", async (orig) => {
  const real =
    await orig<typeof import("@/infra/repositories/weeklyReports.repository")>();
  return { ...real, saveWeeklyReport: (...args: unknown[]) => saveWeeklyReport(...args) };
});

import { useWeeklyReports } from "@/hooks/useWeeklyReports";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const T0 = "2026-09-04T12:04:34.369857+00:00";
const T1 = "2026-09-04T12:05:00.000000+00:00";
const T2 = "2026-09-04T12:06:00.000000+00:00";

function row(updatedAt: string) {
  return {
    id: "603ff40d-8359-4b0a-b280-86fe5af4e5ab",
    project_id: PROJECT,
    week_number: 6,
    week_start: "2026-08-31",
    week_end: "2026-09-06",
    available_at: null,
    data: { executiveSummary: "servidor" },
    created_by: null,
    created_at: T0,
    updated_by: null,
    updated_at: updatedAt,
  };
}

// Com conteúdo, para não acionar o guarda anti-apagão (que faria outro SELECT).
const dados = {
  weekNumber: 6,
  executiveSummary: "texto editado",
  lookaheadTasks: [],
  risksAndIssues: [],
  clientDecisions: [],
  incidents: [],
  gallery: [],
} as unknown as WeeklyReportData;

const conflito = Object.assign(new Error("WEEKLY_REPORT_CONFLICT"), {
  code: "40001",
  details: "",
  hint: "",
  status: 500,
});

function montar() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useWeeklyReports({ projectId: PROJECT }), {
    wrapper,
  });
  return { ...hook, client };
}

function expectedEnviado(chamada: number): string | null {
  return (saveWeeklyReport.mock.calls[chamada][0] as { expectedUpdatedAt: string | null })
    .expectedUpdatedAt;
}

beforeEach(() => {
  saveWeeklyReport.mockReset();
  serverRows = [row(T0)];
});

describe("useWeeklyReports — carimbo de concorrência", () => {
  it("depois de um conflito, a próxima gravação parte do carimbo do servidor", async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    saveWeeklyReport
      .mockImplementationOnce(async () => {
        // Outra pessoa salvou: o servidor já está em T2 quando recusamos.
        serverRows = [row(T2)];
        return { data: null, error: conflito };
      })
      .mockImplementationOnce(async () => ({ data: row(T2), error: null }));

    let rejeitado: unknown = null;
    await act(async () => {
      await result.current
        .saveReport(6, "2026-08-31", "2026-09-06", dados)
        .catch((e: unknown) => {
          rejeitado = e;
        });
      // Retenta IMEDIATAMENTE, como o autosave faz — sem esperar mais nada.
      // A rejeição só pode chegar DEPOIS do refetch: quem retenta já usa T2.
      // Antes, o `onMutate` desta chamada cancelava o refetch, o carimbo
      // ficava em T0 e o pedido repetia o mesmo conflito — para sempre.
      await result.current.saveReport(6, "2026-08-31", "2026-09-06", dados);
    });
    expect(rejeitado).toBe(conflito);
    expect(expectedEnviado(0)).toBe(T0);
    expect(expectedEnviado(1)).toBe(T2);
  });

  it("o carimbo nunca anda para trás por causa de uma linha velha no cache", async () => {
    const { result, client } = montar();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    saveWeeklyReport.mockImplementation(async () => ({
      data: row(T1),
      error: null,
    }));

    await act(async () => {
      await result.current.saveReport(6, "2026-08-31", "2026-09-06", dados);
    });
    expect(expectedEnviado(0)).toBe(T0);

    // Um refetch atrasado (ou o cache persistido) entrega a linha de ANTES
    // da gravação. Sem a proteção, T0 sobrescrevia T1 e a gravação seguinte
    // era recusada por um conflito que nunca existiu.
    await act(async () => {
      client.setQueryData(queryKeys.weeklyReports.list(PROJECT), [row(T0)]);
      // Garante que o cache seja o dado do render, sem refetch em cima.
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.saveReport(6, "2026-08-31", "2026-09-06", dados);
    });
    expect(expectedEnviado(1)).toBe(T1);
  });
});
