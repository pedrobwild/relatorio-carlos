import { describe, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PainelObra } from "@/hooks/usePainelObras";

const TODAY = new Date(2026, 3, 29);
function makeObra(o: Partial<PainelObra>): PainelObra {
  return { id: o.id ?? "x", nome: "x", customer_name: "Cli", engineer_name: null, inicio_oficial: null, entrega_oficial: null, inicio_real: null, entrega_real: null, prazo: null, etapa: o.etapa ?? null, inicio_etapa: null, previsao_avanco: null, status: null, relacionamento: null, external_budget_id: null, responsavel_id: null, responsavel_nome: null, ultima_atualizacao: "2026-04-29T00:00:00Z", is_project_phase: false, progress_percentage: null, pending_count: 0, overdue_count: 0, ...o } as PainelObra;
}
vi.mock("@/hooks/usePainelObras", async () => {
  const a = await vi.importActual<typeof import("@/hooks/usePainelObras")>("@/hooks/usePainelObras");
  return { ...a, usePainelObras: () => ({ obras: [makeObra({ id: "a", etapa: "Medição" })], isLoading: false, error: null, refetch: vi.fn(), updateObra: vi.fn(async () => {}), isUpdating: false }) };
});
vi.mock("@/hooks/useStaffUsers", () => ({ useStaffUsers: () => ({ data: [], isLoading: false }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: "admin", roles: ["admin"], loading: false, isStaff: true, isCustomer: false }) }));
vi.mock("@/components/admin/obras/DadosClienteDialog", () => ({ DadosClienteDialog: () => null }));
vi.mock("@/components/admin/obras/DailyLogInline", () => ({ DailyLogInline: () => null }));

import PainelObras from "@/pages/PainelObras";

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(TODAY); });
describe("dump", () => {
  it("dump html", () => {
    const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={c}><MemoryRouter initialEntries={["/gestao/painel-obras"]}><PainelObras /></MemoryRouter></QueryClientProvider>);
    // eslint-disable-next-line no-console
    console.error("HTML LEN", container.innerHTML.length);
    console.error("HEAD:", container.innerHTML.slice(0, 3000));
  });
});
