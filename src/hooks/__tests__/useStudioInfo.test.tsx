/**
 * Hooks da Ficha da obra: leitura por obra, erro que sobe (para a tela
 * mostrar "tentar de novo") e gravação que atualiza a ficha na hora.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";

const h = vi.hoisted(() => ({
  get: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/infra/repositories/studioInfo.repository", () => ({
  studioInfoRepo: { getStudioInfo: h.get, upsertStudioInfo: h.upsert },
}));

import { useStudioInfo, useUpdateStudioInfo } from "../useStudioInfo";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useStudioInfo", () => {
  beforeEach(() => {
    h.get.mockReset();
    h.upsert.mockReset();
  });

  it("carrega a ficha da obra", async () => {
    h.get.mockResolvedValue({ data: { project_id: "p1", key_location: "Portaria" }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useStudioInfo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.get).toHaveBeenCalledWith("p1");
    expect(result.current.data).toEqual({ project_id: "p1", key_location: "Portaria" });
  });

  it("obra sem ficha: null (carregou, não há linha)", async () => {
    h.get.mockResolvedValue({ data: null, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useStudioInfo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("erro do banco vira erro da consulta (não uma ficha vazia)", async () => {
    h.get.mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useStudioInfo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("sem obra não consulta", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useStudioInfo(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(h.get).not.toHaveBeenCalled();
  });

  it("a ficha (com a senha da fechadura) não vai para o cache gravado no aparelho", async () => {
    h.get.mockResolvedValue({ data: { project_id: "p1", electronic_lock_password: "1234#" }, error: null });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useStudioInfo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({ queryKey: queryKeys.studioInfo.byProject("p1") });
    expect(query?.meta).toMatchObject({ persist: false });
  });
});

describe("useUpdateStudioInfo", () => {
  beforeEach(() => {
    h.get.mockReset();
    h.upsert.mockReset();
  });

  it("grava o patch e a ficha já aparece atualizada", async () => {
    const saved = { project_id: "p1", key_location: "Portaria", concierge_phone: "(11) 3333-4444" };
    h.upsert.mockResolvedValue({ data: saved, error: null });
    h.get.mockResolvedValue({ data: saved, error: null });
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.studioInfo.byProject("p1"), { project_id: "p1", key_location: "Portaria" });
    client.setQueryData(queryKeys.studioInfo.byProject("p2"), { project_id: "p2" });

    const { result } = renderHook(() => useUpdateStudioInfo(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ projectId: "p1", patch: { concierge_phone: "(11) 3333-4444" } });
    });

    expect(h.upsert).toHaveBeenCalledWith("p1", { concierge_phone: "(11) 3333-4444" });
    expect(client.getQueryData(queryKeys.studioInfo.byProject("p1"))).toEqual(saved);
    // Só a ficha desta obra fica marcada para reler.
    expect(client.getQueryState(queryKeys.studioInfo.byProject("p1"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.studioInfo.byProject("p2"))?.isInvalidated).toBe(false);
  });

  it("erro do banco rejeita e não mexe na ficha em cache", async () => {
    h.upsert.mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" } });
    const { client, wrapper } = setup();
    const before = { project_id: "p1", key_location: "Portaria" };
    client.setQueryData(queryKeys.studioInfo.byProject("p1"), before);

    const { result } = renderHook(() => useUpdateStudioInfo(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ projectId: "p1", patch: { key_location: null } })).rejects.toMatchObject({
        code: "42501",
      });
    });
    expect(client.getQueryData(queryKeys.studioInfo.byProject("p1"))).toEqual(before);
  });
});
