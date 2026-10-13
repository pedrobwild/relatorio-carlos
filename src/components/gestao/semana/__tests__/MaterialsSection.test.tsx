/**
 * Material da atividade ligado à compra (gaveta da Semana): com compra
 * vinculada a situação é só leitura ("Vem da compra") e aparece a linha da
 * compra com os avisos; sem vínculo dá para vincular a uma compra da obra ou,
 * com permissão de Compras, pedir a compra a partir do material.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type {
  OpsActivityView,
  OpsMaterialWithPurchase,
  OpsPurchaseSummary,
} from "@/infra/repositories/ops.repository";

const h = vi.hoisted(() => ({
  link: vi.fn(),
  unlink: vi.fn(),
  request: vi.fn(),
  setStatus: vi.fn(),
  can: vi.fn((_f: string) => true),
  purchases: [] as unknown[],
  linkableArgs: [] as unknown[][],
  drawerMaterials: [] as unknown[],
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useOps", () => {
  class PurchaseCreatedButNotLinkedError extends Error {}
  const m = (fn: unknown) => () => ({ mutate: fn, isPending: false });
  return {
    PurchaseCreatedButNotLinkedError,
    useCreateOpsMaterial: m(vi.fn()),
    useCreateOpsReview: m(vi.fn()),
    useDeleteOpsMaterial: m(vi.fn()),
    useUpdateOpsActivity: m(vi.fn()),
    useSetMaterialStatus: m(h.setStatus),
    useLinkMaterialToPurchase: m(h.link),
    useUnlinkMaterialFromPurchase: m(h.unlink),
    useRequestPurchaseForMaterial: m(h.request),
    useOpsActivityAssignments: () => ({ data: [] }),
    useOpsMaterials: () => ({ data: h.drawerMaterials }),
    useOpsReviews: () => ({ data: [] }),
    useOpsLinkablePurchases: (...args: unknown[]) => {
      h.linkableArgs.push(args);
      return { data: h.purchases, isLoading: false, isError: false };
    },
  };
});
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: h.can, loading: false }) }));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));

import { ActivityDrawer, MaterialsSection } from "../ActivityDrawer";

const purchase = (over: Partial<OpsPurchaseSummary> = {}): OpsPurchaseSummary => ({
  id: "c1",
  item_name: "Massa corrida PVA",
  quantity: 4,
  unit: "lata",
  status: "in_transit",
  delivery_location: "obra",
  expected_delivery_date: "2026-10-14",
  actual_delivery_date: null,
  supplier_name: "Loja do Zé",
  fornecedor: null,
  ...over,
});

const material = (over: Partial<OpsMaterialWithPurchase> = {}): OpsMaterialWithPurchase => ({
  id: "m1",
  activity_id: "a1",
  project_id: "p1",
  description: "Massa corrida",
  quantity: 4,
  unit: "lata",
  needed_by: "2026-10-15",
  purchase_id: null,
  purchase: null,
  status: "pendente",
  created_at: "",
  created_by: null,
  updated_at: "",
  ...over,
});

function renderSection(materials: OpsMaterialWithPurchase[]) {
  return render(
    <MaterialsSection activityId="a1" projectId="p1" clientActivityId="st1" activityTitle="Massa na sala" materials={materials} />,
  );
}

describe("MaterialsSection — material ligado à compra", () => {
  beforeEach(() => {
    for (const f of [h.link, h.unlink, h.request, h.setStatus, h.success, h.error]) f.mockReset();
    h.can.mockReset();
    h.can.mockImplementation(() => true);
    h.purchases = [];
    h.linkableArgs = [];
  });

  it("com compra: situação só leitura 'Vem da compra' e a linha da compra", () => {
    renderSection([
      material({ purchase_id: "c1", status: "comprado", purchase: purchase() }),
    ]);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("Comprado")).toBeInTheDocument();
    expect(screen.getByText("Vem da compra")).toBeInTheDocument();
    const line = screen.getByTestId("purchase-line");
    expect(within(line).getByText("Em Trânsito")).toBeInTheDocument();
    expect(within(line).getByText(/Previsto para 14\/10/)).toBeInTheDocument();
    expect(within(line).getByText("Loja do Zé")).toBeInTheDocument();
    expect(screen.queryByText("Chega depois do dia em que é necessário")).toBeNull();
    expect(screen.queryByRole("button", { name: /Vincular a uma compra/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pedir compra/ })).toBeNull();
  });

  it("entregue: 'Entregue em dd/mm'", () => {
    renderSection([
      material({
        purchase_id: "c1",
        status: "na_obra",
        purchase: purchase({ status: "delivered", actual_delivery_date: "2026-10-13" }),
      }),
    ]);
    const line = screen.getByTestId("purchase-line");
    expect(within(line).getByText("Entregue")).toBeInTheDocument();
    expect(within(line).getByText(/Entregue em 13\/10/)).toBeInTheDocument();
  });

  it("avisa quando a previsão de entrega é depois do dia necessário", () => {
    renderSection([
      material({ purchase_id: "c1", status: "comprado", purchase: purchase({ expected_delivery_date: "2026-10-16" }) }),
    ]);
    expect(screen.getByText("Chega depois do dia em que é necessário")).toBeInTheDocument();
  });

  it("avisa compra cancelada", () => {
    renderSection([
      material({ purchase_id: "c1", status: "pendente", purchase: purchase({ status: "cancelled" }) }),
    ]);
    expect(screen.getByText("Compra cancelada")).toBeInTheDocument();
    expect(within(screen.getByTestId("purchase-line")).getByText("Cancelado")).toBeInTheDocument();
  });

  it("Desvincular volta a situação para manual", () => {
    renderSection([material({ purchase_id: "c1", status: "comprado", purchase: purchase() })]);
    fireEvent.click(screen.getByRole("button", { name: /Desvincular/ }));
    expect(h.unlink).toHaveBeenCalledWith("m1", expect.any(Object));
  });

  it("sem compra: situação manual e vincular pelo seletor (com busca)", () => {
    h.purchases = [
      purchase({ id: "c1", item_name: "Porcelanato 60x60", status: "approved", expected_delivery_date: null }),
      purchase({ id: "c2", item_name: "Massa corrida PVA", expected_delivery_date: "2026-10-16" }),
    ];
    renderSection([material()]);
    expect(screen.getByRole("radiogroup", { name: "Situação de Massa corrida" })).toBeInTheDocument();
    // O seletor só busca as compras quando abre.
    expect(h.linkableArgs.at(-1)).toEqual(["p1", false]);

    fireEvent.click(screen.getByRole("button", { name: /Vincular a uma compra/ }));
    expect(h.linkableArgs.at(-1)).toEqual(["p1", true]);
    const list = screen.getByRole("list", { name: "Compras da obra" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(within(list).getByText(/4 lata · Aprovado/)).toBeInTheDocument();
    expect(within(list).getByText(/Previsto para 16\/10/)).toBeInTheDocument();
    expect(within(list).getByText("Chega depois do dia em que é necessário")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar compra" }), { target: { value: "massa" } });
    const filtered = within(screen.getByRole("list", { name: "Compras da obra" })).getAllByRole("button");
    expect(filtered).toHaveLength(1);
    fireEvent.click(filtered[0]);
    expect(h.link).toHaveBeenCalledWith({ materialId: "m1", purchaseId: "c2" }, expect.any(Object));
  });

  it("Pedir compra só com permissão de criar compra", () => {
    h.can.mockImplementation((f: string) => f !== "purchases:create");
    renderSection([material()]);
    expect(screen.getByRole("button", { name: /Vincular a uma compra/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pedir compra/ })).toBeNull();
    expect(h.can).toHaveBeenCalledWith("purchases:create");
  });

  it("Pedir compra cria a solicitação a partir do material e vincula", () => {
    renderSection([material()]);
    fireEvent.click(screen.getByRole("button", { name: /Pedir compra/ }));
    expect(h.request).toHaveBeenCalledTimes(1);
    const [vars] = h.request.mock.calls[0];
    expect(vars).toEqual({
      materialId: "m1",
      purchase: expect.objectContaining({
        project_id: "p1",
        activity_id: "st1",
        item_name: "Massa corrida",
        quantity: 4,
        unit: "lata",
        required_by_date: "2026-10-15",
      }),
    });
  });

  it("Pedir compra sem 'precisa até' pede a data antes", () => {
    renderSection([material({ needed_by: null })]);
    fireEvent.click(screen.getByRole("button", { name: /Pedir compra/ }));
    expect(h.request).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Confirmar pedido" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Precisa estar na obra até", { selector: "#pedir-m1" }), {
      target: { value: "2026-10-22" },
    });
    fireEvent.click(confirm);
    expect(h.request.mock.calls[0][0].purchase.required_by_date).toBe("2026-10-22");
  });
});

describe("Pedir compra — a compra aponta para o cronograma do CLIENTE", () => {
  beforeEach(() => {
    h.request.mockReset();
    h.can.mockImplementation(() => true);
    h.purchases = [];
  });

  it("etapa só interna (sem atividade do cliente): activity_id null", () => {
    render(<MaterialsSection activityId="a1" projectId="p1" clientActivityId={null} materials={[material()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Pedir compra/ }));
    expect(h.request.mock.calls[0][0].purchase.activity_id).toBeNull();
  });

  it("gaveta da Semana usa stage_client_activity_id, nunca o id do item interno", () => {
    h.drawerMaterials = [material()];
    const activity = {
      id: "a1",
      project_id: "p1",
      title: "Massa na sala",
      status: "planejada",
      stage_id: "item-interno-1",
      stage_name: "Pintura",
      stage_client_activity_id: "cli-1",
    } as unknown as OpsActivityView;
    render(<ActivityDrawer activity={activity} open onOpenChange={vi.fn()} staffNameById={new Map()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pedir compra/ }));
    expect(h.request.mock.calls[0][0].purchase.activity_id).toBe("cli-1");
    h.drawerMaterials = [];
  });
});
