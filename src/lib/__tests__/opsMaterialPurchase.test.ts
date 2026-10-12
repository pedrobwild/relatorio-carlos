/**
 * Situação do material vinda da compra: a tabela do app tem de ser a mesma
 * do banco (`ops_material_status_from_purchase`). Cada linha da tabela do
 * cabeçalho da migration está fixada aqui — e o texto da função SQL é
 * conferido, para que mudar um lado sem o outro quebre o teste.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPurchaseRequestFromMaterial,
  filterPurchasesByText,
  isPurchaseCancelled,
  isPurchaseLate,
  opsMaterialStatusFromPurchase,
  purchaseDeliveryText,
  purchaseStatusLabel,
  purchaseSupplierName,
  shortDayMonth,
} from "../opsMaterialPurchase";
import { statusConfig } from "@/pages/compras/types";

describe("opsMaterialStatusFromPurchase — espelho da função do banco", () => {
  const rows: [status: string | null, location: string | null, expected: string][] = [
    ["pending", null, "pendente"],
    ["awaiting_approval", null, "pendente"],
    ["approved", null, "pendente"],
    ["delayed", null, "pendente"],
    ["cancelled", null, "pendente"],
    ["purchased", null, "comprado"],
    ["ordered", null, "comprado"],
    ["in_transit", null, "comprado"],
    ["delivered", null, "na_obra"],
    ["delivered", "obra", "na_obra"],
    ["delivered", "retirada", "na_obra"],
    ["delivered", "estoque", "comprado"],
    ["delivered", "escritorio", "comprado"],
    ["sent_to_site", null, "na_obra"],
    ["sent_to_site", "estoque", "na_obra"],
    ["sent_to_site", "escritorio", "na_obra"],
    ["algo_novo", null, "pendente"],
    [null, null, "pendente"],
  ];

  it.each(rows)("%s (entrega: %s) → %s", (status, location, expected) => {
    expect(opsMaterialStatusFromPurchase(status, location)).toBe(expected);
  });

  it("o local de entrega só importa para 'delivered'", () => {
    for (const s of ["pending", "purchased", "ordered", "in_transit", "cancelled"]) {
      expect(opsMaterialStatusFromPurchase(s, "estoque")).toBe(opsMaterialStatusFromPurchase(s, null));
    }
  });

  it("a função SQL da migration tem exatamente estas regras", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20261012140000_ops_materials_purchase_link.sql"),
      "utf8",
    );
    const fn = sql.match(/FUNCTION public\.ops_material_status_from_purchase\([\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] ?? "";
    const norm = fn.replace(/\s+/g, " ");
    expect(norm).toContain("WHEN p_status = 'sent_to_site' THEN 'na_obra'");
    expect(norm).toContain("WHEN p_status = 'delivered' THEN CASE WHEN p_delivery_location IN ('estoque', 'escritorio') THEN 'comprado'");
    expect(norm).toContain("ELSE 'na_obra'");
    expect(norm).toContain("WHEN p_status IN ('purchased', 'ordered', 'in_transit') THEN 'comprado'");
    expect(norm).toContain("ELSE 'pendente'");
    // Nenhum outro status citado na função além dos fixados acima.
    const cited = [...norm.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(new Set(cited)).toEqual(
      new Set(["sent_to_site", "na_obra", "delivered", "estoque", "escritorio", "comprado", "purchased", "ordered", "in_transit", "pendente"]),
    );
  });
});

describe("purchaseStatusLabel", () => {
  it("usa o mesmo texto das telas de Compras", () => {
    for (const [status, cfg] of Object.entries(statusConfig)) {
      expect(purchaseStatusLabel(status)).toBe(cfg.label);
    }
    expect(purchaseStatusLabel("purchased")).toBe("Compra Realizada");
    expect(purchaseStatusLabel("sent_to_site")).toBe("Enviado p/ Obra");
  });

  it("'delayed' é 'Atrasado' (Calendário de Compras); desconhecido aparece cru", () => {
    expect(purchaseStatusLabel("delayed")).toBe("Atrasado");
    expect(purchaseStatusLabel("xyz")).toBe("xyz");
    expect(purchaseStatusLabel(null)).toBe("Sem situação");
  });
});

describe("linha da compra", () => {
  const p = (over: Partial<Parameters<typeof purchaseDeliveryText>[0]> = {}) => ({
    status: "ordered",
    expected_delivery_date: null,
    actual_delivery_date: null,
    ...over,
  });

  it("dd/mm sem deslocamento de fuso", () => {
    expect(shortDayMonth("2026-10-01")).toBe("01/10");
    expect(shortDayMonth("2026-12-31")).toBe("31/12");
    expect(shortDayMonth("2026-10-01T00:00:00+00:00")).toBe("01/10");
  });

  it("Entregue em › Previsto para › nada", () => {
    expect(purchaseDeliveryText(p({ expected_delivery_date: "2026-10-14" }))).toBe("Previsto para 14/10");
    expect(
      purchaseDeliveryText(p({ status: "delivered", expected_delivery_date: "2026-10-14", actual_delivery_date: "2026-10-13" })),
    ).toBe("Entregue em 13/10");
    expect(purchaseDeliveryText(p())).toBeNull();
    expect(purchaseDeliveryText(p({ status: "cancelled", expected_delivery_date: "2026-10-14" }))).toBeNull();
  });

  it("atrasada: previsão depois do dia em que é necessário", () => {
    expect(isPurchaseLate(p({ expected_delivery_date: "2026-10-15" }), "2026-10-14")).toBe(true);
    expect(isPurchaseLate(p({ expected_delivery_date: "2026-10-14" }), "2026-10-14")).toBe(false);
    expect(isPurchaseLate(p({ expected_delivery_date: "2026-10-13" }), "2026-10-14")).toBe(false);
    expect(isPurchaseLate(p({ expected_delivery_date: "2026-10-15" }), null)).toBe(false);
    expect(isPurchaseLate(p(), "2026-10-14")).toBe(false);
  });

  it("não acusa atraso do que já chegou nem do que foi cancelado", () => {
    expect(isPurchaseLate(p({ status: "delivered", expected_delivery_date: "2026-10-15" }), "2026-10-14")).toBe(false);
    expect(isPurchaseLate(p({ status: "sent_to_site", expected_delivery_date: "2026-10-15" }), "2026-10-14")).toBe(false);
    expect(
      isPurchaseLate(p({ expected_delivery_date: "2026-10-15", actual_delivery_date: "2026-10-12" }), "2026-10-14"),
    ).toBe(false);
    expect(isPurchaseLate(p({ status: "cancelled", expected_delivery_date: "2026-10-15" }), "2026-10-14")).toBe(false);
  });

  it("cancelada", () => {
    expect(isPurchaseCancelled({ status: "cancelled" })).toBe(true);
    expect(isPurchaseCancelled({ status: "pending" })).toBe(false);
  });
});

describe("Pedir compra a partir do material", () => {
  it("leva item, quantidade, unidade, data necessária, obra e etapa do cronograma", () => {
    const input = buildPurchaseRequestFromMaterial(
      { description: "  Massa corrida ", quantity: 3, unit: "lata" },
      { projectId: "p1", stageId: "st1", activityTitle: "Massa na sala", requiredBy: "2026-10-20" },
    );
    expect(input).toEqual({
      project_id: "p1",
      activity_id: "st1",
      item_name: "Massa corrida",
      quantity: 3,
      unit: "lata",
      required_by_date: "2026-10-20",
      lead_time_days: 7,
      purchase_type: "produto",
      notes: 'Pedido pela Semana · atividade "Massa na sala"',
    });
    // Situação: a padrão do banco ("Pendente"), como no formulário de Compras.
    expect("status" in input).toBe(false);
  });

  it("sem quantidade/unidade/etapa usa os padrões de Compras", () => {
    const input = buildPurchaseRequestFromMaterial(
      { description: "Cola", quantity: null, unit: "  " },
      { projectId: "p1", stageId: null, requiredBy: "2026-10-20" },
    );
    expect(input.quantity).toBe(1);
    expect(input.unit).toBe("un");
    expect(input.activity_id).toBeNull();
    expect(input.notes).toBe("Pedido pela Semana");
  });
});

describe("busca de compras no seletor", () => {
  const list = [
    { id: "1", item_name: "Porcelanato 60x60", supplier_name: null, fornecedor: { nome: "Cerâmica São João" } },
    { id: "2", item_name: "Argamassa AC-III", supplier_name: "Loja do Zé", fornecedor: null },
    { id: "3", item_name: "Tinta acrílica", supplier_name: null, fornecedor: null },
  ];
  it("vazio devolve tudo, na mesma ordem", () => {
    expect(filterPurchasesByText(list, "  ").map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
  it("por item ou fornecedor, sem acento nem maiúscula, todas as palavras", () => {
    expect(filterPurchasesByText(list, "ceramica").map((p) => p.id)).toEqual(["1"]);
    expect(filterPurchasesByText(list, "ARGAMASSA zé").map((p) => p.id)).toEqual(["2"]);
    expect(filterPurchasesByText(list, "tinta ze")).toEqual([]);
  });
  it("fornecedor: cadastro primeiro, depois texto livre", () => {
    expect(purchaseSupplierName(list[0])).toBe("Cerâmica São João");
    expect(purchaseSupplierName(list[1])).toBe("Loja do Zé");
    expect(purchaseSupplierName(list[2])).toBeNull();
  });
});
