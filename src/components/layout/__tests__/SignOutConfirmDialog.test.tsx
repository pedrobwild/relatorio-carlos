/**
 * "Sair" com registros ainda não enviados neste aparelho: pergunta antes,
 * deixa esperar, e só apaga o que é desta conta quando a pessoa confirma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {}, from: vi.fn(), storage: {} } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "pedro@x.com" },
    loading: false,
    signOut: h.signOut,
    isAuthenticated: true,
  }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));

import { AppHeader } from "@/components/AppHeader";
import { __setOutcomeOutboxForTests, getOutcomeOutbox, type SetOutcomeVars } from "@/lib/offline/opsOutcomeSync";
import { createOutbox } from "@/lib/offline/outcomeOutbox";
import { createMemoryStorage } from "@/lib/offline/idb";
import { getOpsPhotoQueue } from "@/lib/offline/opsPhotoSync";

function renderHeader() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const photo = () => Object.assign(new Blob(["x"], { type: "image/jpeg" }), { name: "f.jpg" });

beforeEach(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.signOut.mockReset().mockResolvedValue(undefined);
  onlineManager.setOnline(false);
  __setOutcomeOutboxForTests(createOutbox<SetOutcomeVars>(createMemoryStorage()), "u1");
  const q = getOpsPhotoQueue();
  await q.discardUser("u1");
  await q.discardUser("u2");
});

describe("Sair com registros não enviados", () => {
  it("nada pendente: sai direto, sem perguntar", async () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("com pendências: mostra quantos, e 'Esperar o envio' não sai nem apaga", async () => {
    getOutcomeOutbox().add("u1", { id: "a", outcome: "feito" });
    await act(async () => {
      await getOpsPhotoQueue().enqueue({ userId: "u1", assignmentId: "a", projectId: "p" }, [photo()]);
    });
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Há registros não enviados");
    expect(dialog).toHaveTextContent("2 registros ainda não foram enviados");
    fireEvent.click(screen.getByRole("button", { name: "Esperar o envio" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(h.signOut).not.toHaveBeenCalled();
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(1);
    expect(getOpsPhotoQueue().getSnapshot().filter((p) => p.userId === "u1")).toHaveLength(1);
  });

  it("'Sair mesmo assim' apaga só o que é desta conta e sai", async () => {
    getOutcomeOutbox().add("u1", { id: "a", outcome: "feito" });
    getOutcomeOutbox().add("u2", { id: "b", outcome: "feito" });
    await act(async () => {
      await getOpsPhotoQueue().enqueue({ userId: "u2", assignmentId: "b", projectId: "p" }, [photo()]);
    });
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("1 registro ainda não foi enviado");

    fireEvent.click(screen.getByRole("button", { name: "Sair mesmo assim" }));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(0);
    expect(getOutcomeOutbox().forUser("u2")).toHaveLength(1);
    expect(getOpsPhotoQueue().getSnapshot().map((p) => p.userId)).toEqual(["u2"]);
  });
});
