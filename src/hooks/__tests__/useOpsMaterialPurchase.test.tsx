/**
 * Material ligado à compra (hooks): "Pedir compra" cria pelo caminho de
 * Compras e vincula; vincular/desvincular relê a operação e o Painel (a
 * situação muda no banco — nada é adivinhado na tela).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/queryKeys";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
  invalidatePurchases: vi.fn(),
}));

vi.mock("@/infra/repositories/purchases.repository", () => ({ purchasesRepo: { create: h.create } }));
vi.mock("@/infra/repositories/ops.repository", () => ({
  opsRepo: { linkMaterialToPurchase: h.link, unlinkMaterialFromPurchase: h.unlink },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/queryKeys", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryKeys")>("@/lib/queryKeys");
  return { ...actual, invalidatePurchaseQueries: h.invalidatePurchases };
});

import {
  PurchaseCreatedButNotLinkedError,
  useLinkMaterialToPurchase,
  useRequestPurchaseForMaterial,
  useUnlinkMaterialFromPurchase,
} from "../useOps";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper, invalidate };
}

const invalidatedKeys = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

const purchaseInput = {
  project_id: "p1",
  activity_id: "st1",
  item_name: "Massa corrida",
  quantity: 4,
  unit: "lata",
  required_by_date: "2026-10-15",
  lead_time_days: 7,
};

describe("material ligado à compra — hooks", () => {
  beforeEach(() => {
    for (const f of Object.values(h)) f.mockReset();
  });

  it("Pedir compra: cria pelo purchasesRepo (com quem pediu) e vincula o material à compra criada", async () => {
    h.create.mockResolvedValue({ data: { id: "c9" }, error: null });
    h.link.mockResolvedValue({ data: { id: "m1", purchase_id: "c9", status: "pendente" }, error: null });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useRequestPurchaseForMaterial(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ materialId: "m1", purchase: purchaseInput });
    });
    expect(h.create).toHaveBeenCalledWith(purchaseInput, "u1");
    expect(h.link).toHaveBeenCalledWith("m1", "c9");
    expect(h.create.mock.invocationCallOrder[0]).toBeLessThan(h.link.mock.invocationCallOrder[0]);
    expect(h.invalidatePurchases).toHaveBeenCalled();
    expect(invalidatedKeys(invalidate)).toEqual(
      expect.arrayContaining([queryKeys.ops.all, queryKeys.obrasPanel.all]),
    );
  });

  it("Pedir compra: falha ao criar não tenta vincular", async () => {
    h.create.mockResolvedValue({ data: null, error: { code: "42501", message: "rls" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRequestPurchaseForMaterial(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ materialId: "m1", purchase: purchaseInput })).rejects.toBeTruthy();
    });
    expect(h.link).not.toHaveBeenCalled();
  });

  it("Pedir compra: compra criada mas vínculo recusado → erro próprio com o id da compra", async () => {
    h.create.mockResolvedValue({ data: { id: "c9" }, error: null });
    h.link.mockResolvedValue({ data: null, error: { code: "23514", message: "A compra vinculada é de outra obra" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRequestPurchaseForMaterial(), { wrapper });
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ materialId: "m1", purchase: purchaseInput });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeInstanceOf(PurchaseCreatedButNotLinkedError);
    expect((caught as PurchaseCreatedButNotLinkedError).purchaseId).toBe("c9");
    // Mesmo assim relê Compras (a compra existe).
    expect(h.invalidatePurchases).toHaveBeenCalled();
  });

  it("vincular e desvincular releem a operação (material, semana, Hoje) e o Painel", async () => {
    h.link.mockResolvedValue({ data: { id: "m1" }, error: null });
    h.unlink.mockResolvedValue({ data: { id: "m1" }, error: null });
    const { wrapper, invalidate } = setup();
    const link = renderHook(() => useLinkMaterialToPurchase(), { wrapper });
    await act(async () => {
      await link.result.current.mutateAsync({ materialId: "m1", purchaseId: "c1" });
    });
    expect(h.link).toHaveBeenCalledWith("m1", "c1");
    await waitFor(() =>
      expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([queryKeys.ops.all, queryKeys.obrasPanel.all])),
    );

    invalidate.mockClear();
    const unlink = renderHook(() => useUnlinkMaterialFromPurchase(), { wrapper });
    await act(async () => {
      await unlink.result.current.mutateAsync("m1");
    });
    expect(h.unlink).toHaveBeenCalledWith("m1");
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([queryKeys.ops.all, queryKeys.obrasPanel.all]));
  });

  it("as chaves da operação cobrem material, semana, dia e seletor de compras", () => {
    const all = queryKeys.ops.all;
    for (const key of [
      queryKeys.ops.materials("a1"),
      queryKeys.ops.projectMaterials("p1"),
      queryKeys.ops.day("2026-10-12"),
      queryKeys.ops.readiness(["a1"]),
      queryKeys.ops.linkablePurchases("p1"),
    ]) {
      expect(key.slice(0, all.length)).toEqual([...all]);
    }
  });
});
