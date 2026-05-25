/**
 * Regressão: ao voltar para "Obra/Obras" e reentrar no relatório, o
 * WeeklyReportTemplate deve sempre montar (não pode ficar preso no fallback
 * do Suspense). O padrão de proteção em Index.tsx é dar `key` único, baseado
 * em `projectId` + `weekNumber`, tanto no <Suspense> quanto no componente
 * lazy — isso força React a desmontar a árvore antiga e montar uma nova
 * após cada navegação.
 *
 * Este teste valida o contrato: alterar a key remonta de fato o conteúdo
 * e o fallback desaparece assim que o lazy resolve.
 */
import React, { Suspense, lazy, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Cria um lazy controlável: cada montagem resolve a Promise quando o teste
// chama `resolve()`. Permite simular Suspense pendente -> resolvido.
function createDeferredLazy(label: string) {
  let resolveFn: (mod: { default: React.ComponentType }) => void = () => {};
  const promise = new Promise<{ default: React.ComponentType }>((res) => {
    resolveFn = res;
  });
  const Lazy = lazy(() => promise);
  const Component: React.ComponentType = () => (
    <div data-report-template-ready="true">Conteúdo {label}</div>
  );
  return {
    Lazy,
    resolve: () => resolveFn({ default: Component }),
  };
}

describe("WeeklyReportTemplate — remount após navegação (Obra/Obras)", () => {
  it("ao mudar a key do Suspense+template, fallback some e novo conteúdo monta (não fica preso)", async () => {
    const first = createDeferredLazy("semana-1");
    const second = createDeferredLazy("semana-2");

    // Mantém referência pra trocar de "instância lazy" como o lazy do Index
    // seria reaproveitado, mas com `key` diferente — o React desmonta e
    // remonta a árvore mesmo assim. Simulamos isso com keys distintas.
    const Harness = () => {
      const [weekKey, setWeekKey] = useState("proj-1-week-1");
      const isFirst = weekKey === "proj-1-week-1";
      const Lazy = isFirst ? first.Lazy : second.Lazy;
      return (
        <div>
          <button onClick={() => setWeekKey("proj-2-week-2")}>trocar</button>
          <Suspense
            key={`weekly-report-${weekKey}`}
            fallback={
              <div role="status" aria-busy="true">
                Carregando relatório…
              </div>
            }
          >
            <Lazy key={`weekly-report-tpl-${weekKey}`} />
          </Suspense>
        </div>
      );
    };

    render(<Harness />);

    // 1) Fallback aparece enquanto a 1ª semana ainda não resolveu
    expect(screen.getByRole("status")).toBeInTheDocument();

    // 2) Resolve -> template da semana 1 monta e fallback some
    await Promise.resolve(first.resolve());
    await waitFor(() =>
      expect(screen.getByText("Conteúdo semana-1")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // 3) Simula "voltar para Obra/Obras e reentrar em outra semana": muda a key
    fireEvent.click(screen.getByText("trocar"));

    // Conteúdo antigo é desmontado (não pode persistir como fantasma)
    expect(screen.queryByText("Conteúdo semana-1")).not.toBeInTheDocument();
    // Suspense da nova árvore exibe fallback fresco (não fica preso vazio)
    expect(screen.getByRole("status")).toBeInTheDocument();

    // 4) Resolve a 2ª e garante que o template NOVO realmente montou
    await Promise.resolve(second.resolve());
    await waitFor(() =>
      expect(screen.getByText("Conteúdo semana-2")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("WeeklyReportTemplate real expõe marcador data-report-template-ready ao montar", async () => {
    // Garante que o componente real possui o hook visual usado pelo Index para
    // confirmar montagem (evita falsos positivos de 'preso no Suspense').
    vi.doMock("@/components/report/WeeklyReportEditor", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/ExecutiveSummary", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/LookaheadSection", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/RisksIssuesSection", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/ClientDecisionsSection", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/IncidentsSection", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/PhotoGallery", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/ReportFooter", () => ({
      default: () => null,
    }));
    vi.doMock("@/components/report/ProgressTimeline", () => ({
      default: () => null,
    }));

    const { default: WeeklyReportTemplate } = await import(
      "@/components/report/WeeklyReportTemplate"
    );

    const { container, rerender } = render(
      <WeeklyReportTemplate
        data={{
          projectId: "p1",
          projectName: "Obra",
          unitName: "Unid",
          clientName: "Cliente",
          weekNumber: 1,
          weekStart: "2025-01-06",
          weekEnd: "2025-01-12",
          executiveSummary: "",
          lookaheadTasks: [],
          risksAndIssues: [],
          clientDecisions: [],
          incidents: [],
          gallery: [],
          deliverablesCompleted: [],
          roomsProgress: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />,
    );
    expect(
      container.querySelector('[data-report-template-ready="true"]'),
    ).toBeInTheDocument();

    // Simula remount (nova semana): marcador deve continuar presente.
    rerender(
      <WeeklyReportTemplate
        key="p2-w2"
        data={{
          projectId: "p2",
          projectName: "Obra 2",
          unitName: "Unid 2",
          clientName: "Cliente 2",
          weekNumber: 2,
          weekStart: "2025-01-13",
          weekEnd: "2025-01-19",
          executiveSummary: "",
          lookaheadTasks: [],
          risksAndIssues: [],
          clientDecisions: [],
          incidents: [],
          gallery: [],
          deliverablesCompleted: [],
          roomsProgress: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />,
    );
    expect(
      container.querySelector('[data-report-template-ready="true"]'),
    ).toBeInTheDocument();
  });
});
