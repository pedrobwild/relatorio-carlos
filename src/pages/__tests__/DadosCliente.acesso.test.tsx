/**
 * Integração: Local da chave + Senha da fechadura
 *
 * Verifica que ao clicar em "Salvar" os valores digitados são enviados
 * ao banco (upsert em project_studio_info) e que ao remontar a página
 * eles são recarregados nos inputs corretos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mock supabase client com store em memória para project_studio_info ──
const studioStore: Record<string, any> = {};
const upsertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "project_studio_info") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({
              data: studioStore[val] ?? null,
              error: null,
            }),
          }),
        }),
        upsert: (payload: any) => {
          upsertSpy(payload);
          studioStore[payload.project_id] = { ...payload };
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "projects") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { name: "Obra Teste", unit_name: null },
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  };
  return {
    supabase: {
      from: vi.fn(from),
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
    },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

// Stub do ProjectInfoDoc (não relevante para este teste e faz queries extras)
vi.mock("@/components/project/ProjectInfoDoc", () => ({
  ProjectInfoDoc: () => null,
}));

// Stub useCepLookup
vi.mock("@/hooks/useCepLookup", async () => {
  const actual = await vi.importActual<any>("@/hooks/useCepLookup");
  return {
    ...actual,
    useCepLookup: () => ({ lookup: vi.fn(), loading: false }),
  };
});

import DadosCliente from "@/pages/DadosCliente";

const PROJECT_ID = "proj-123";

function renderPage() {
  return render(
    <MemoryRouter>
      <DadosCliente projectId={PROJECT_ID} embedded />
    </MemoryRouter>,
  );
}

describe("DadosCliente · Acesso à obra (persistência)", () => {
  beforeEach(() => {
    for (const k of Object.keys(studioStore)) delete studioStore[k];
    upsertSpy.mockClear();
  });

  it("persiste Local da chave e Senha ao salvar e recarrega ao remontar", async () => {
    renderPage();

    // Tab "Informações do Projeto" abriga o card "Acesso à obra"
    const infoTab = await screen.findByRole("tab", {
      name: /Informações do Projeto/i,
    });
    await userEvent.click(infoTab);

    const keyInput = await screen.findByLabelText(/Local da chave/i);
    const lockInput = await screen.findByLabelText(
      /Senha da fechadura eletrônica/i,
    );

    fireEvent.change(keyInput, {
      target: { value: "Portaria — falar com Sr. João" },
    });
    fireEvent.change(lockInput, { target: { value: "1234#" } });

    const saveBtn = screen.getByRole("button", { name: /Salvar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledTimes(1);
    });

    const payload = upsertSpy.mock.calls[0][0];
    expect(payload.project_id).toBe(PROJECT_ID);
    expect(payload.key_location).toBe("Portaria — falar com Sr. João");
    expect(payload.electronic_lock_password).toBe("1234#");

    // ── Remonta a página: deve recarregar do "banco" (store) ──
    cleanup();
    renderPage();

    const infoTab2 = await screen.findByRole("tab", {
      name: /Informações do Projeto/i,
    });
    await userEvent.click(infoTab2);

    const reloadedKey = (await screen.findByLabelText(
      /Local da chave/i,
    )) as HTMLInputElement;
    const reloadedLock = (await screen.findByLabelText(
      /Senha da fechadura eletrônica/i,
    )) as HTMLInputElement;

    expect(reloadedKey.value).toBe("Portaria — falar com Sr. João");
    expect(reloadedLock.value).toBe("1234#");
  });

  it("grava null quando os campos ficam vazios", async () => {
    studioStore[PROJECT_ID] = {
      project_id: PROJECT_ID,
      key_location: "antigo",
      electronic_lock_password: "antiga",
    };

    renderPage();

    const infoTab = await screen.findByRole("tab", {
      name: /Informações do Projeto/i,
    });
    await userEvent.click(infoTab);

    const keyInput = (await screen.findByLabelText(
      /Local da chave/i,
    )) as HTMLInputElement;
    const lockInput = (await screen.findByLabelText(
      /Senha da fechadura eletrônica/i,
    )) as HTMLInputElement;

    expect(keyInput.value).toBe("antigo");
    expect(lockInput.value).toBe("antiga");

    fireEvent.change(keyInput, { target: { value: "" } });
    fireEvent.change(lockInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1));
    const payload = upsertSpy.mock.calls[0][0];
    expect(payload.key_location).toBeNull();
    expect(payload.electronic_lock_password).toBeNull();
  });
});
