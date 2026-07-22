/**
 * Integração: ProjectContext + useLinkCustomerOnLogin.
 *
 * Regressão do bug "Projeto não encontrado" após login para clientes cuja
 * linha em `project_customers` foi criada com `customer_user_id = NULL`
 * (vínculo pendente). O fluxo real é:
 *  1) primeira busca de projeto retorna null (RLS esconde a obra);
 *  2) o ProjectContext dispara `ensureCustomerProjectLink({ force: true })`,
 *     que faz UPDATE em `project_customers.customer_user_id` por e-mail;
 *  3) o backfill/trigger no banco cria a linha em `project_members`;
 *  4) o retry do getProjectWithCustomer devolve a obra e a tela abre normal.
 *
 * Este teste exercita esse fluxo end-to-end no cliente: usa o ProjectProvider
 * real, o ensureCustomerProjectLink real e o projectsRepo real. Só o cliente
 * Supabase é mockado com um builder chainable que muda de estado quando o
 * link é aplicado — garantindo que qualquer regressão que volte a mostrar
 * "Projeto não encontrado" sem tentar re-linkar quebre o CI.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { ProjectProvider, useProject } from "../ProjectContext";

const PROJECT_ID = "p-1";
const USER = {
  id: "user-1",
  email: "cliente@exemplo.com",
  user_metadata: { role: "customer" },
};
const PROJECT_ROW = {
  id: PROJECT_ID,
  name: "Obra Backfill",
  status: "active",
  is_project_phase: false,
  deleted_at: null,
  project_customers: [
    { customer_name: "Cliente Exemplo", customer_email: USER.email },
  ],
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: USER }) }));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isCustomer: true, isStaff: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/amplitude", () => ({ trackAmplitude: vi.fn() }));
vi.mock("@/lib/errorLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));


/**
 * Estado compartilhado que simula o banco:
 *  - linkedUserId=null → RLS esconde a obra (project SELECT devolve null).
 *  - Após UPDATE em project_customers, linkedUserId passa a ser user.id e
 *    a próxima busca de project devolve o registro.
 */
const dbState = {
  linkedUserId: null as string | null,
  updateCalls: 0,
};

function makeProjectSelectBuilder() {
  // Cadeia: .from("projects").select(...).eq(...).is(...).maybeSingle()
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    maybeSingle: async () => {
      if (dbState.linkedUserId === USER.id) {
        return { data: PROJECT_ROW, error: null };
      }
      return { data: null, error: null };
    },
  };
  return builder;
}

function makeProjectCustomersBuilder() {
  // Suporta a leitura (select→eq→is) e a atualização (update→eq→is) usadas
  // por ensureCustomerProjectLink.
  const readBuilder: any = {
    select: () => readBuilder,
    eq: () => readBuilder,
    is: () => readBuilder,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(
        dbState.linkedUserId === USER.id
          ? { data: [], error: null }
          : {
              data: [
                {
                  id: "pc-1",
                  project_id: PROJECT_ID,
                  customer_name: "Cliente Exemplo",
                },
              ],
              error: null,
            },
      ).then(resolve),
  };

  const updateBuilder: any = {
    eq: () => updateBuilder,
    is: () => updateBuilder,
    then: (resolve: (v: unknown) => unknown) => {
      dbState.linkedUserId = USER.id;
      dbState.updateCalls += 1;
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };

  return {
    select: readBuilder.select,
    eq: readBuilder.eq,
    is: readBuilder.is,
    then: readBuilder.then,
    update: () => updateBuilder,
  };
}

vi.mock("@/integrations/supabase/client", () => {
  const supabase = {
    from: (table: string) => {
      if (table === "projects") return makeProjectSelectBuilder();
      if (table === "project_customers") return makeProjectCustomersBuilder();
      throw new Error(`unexpected table in test: ${table}`);
    },
  };
  return { supabase };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/obra/${PROJECT_ID}`]}>
      <Routes>
        <Route
          path="/obra/:projectId"
          element={<ProjectProvider>{children}</ProjectProvider>}
        />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("ProjectContext ↔ ensureCustomerProjectLink (integração)", () => {
  beforeEach(() => {
    dbState.linkedUserId = null;
    dbState.updateCalls = 0;
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("faz backfill do vínculo e abre a obra em vez de mostrar 'Projeto não encontrado'", async () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Passou pelo caminho de recuperação: fez o UPDATE em project_customers,
    // e a segunda busca já viu a obra.
    expect(dbState.updateCalls).toBeGreaterThanOrEqual(1);
    expect(result.current.error).toBeNull();
    expect(result.current.project).toMatchObject({
      id: PROJECT_ID,
      name: "Obra Backfill",
    });
  });
});
