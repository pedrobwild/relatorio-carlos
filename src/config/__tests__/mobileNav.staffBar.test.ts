import { describe, it, expect } from "vitest";
import { Building2, ClipboardSignature, DollarSign, FolderOpen } from "lucide-react";
import {
  CLIENT_NAV,
  REGISTRAR_SLOT,
  STAFF_NAV,
  STAFF_OBRAS_LEGADO,
  STAFF_OBRAS_NOVO,
  resolveActiveStaffSlotId,
  staffBottomBar,
  type StaffBarItem,
} from "@/config/mobileNav";

/**
 * Barra da equipe no celular (redesenho mobile, passo 1) e a garantia de que
 * a barra do cliente não mudou.
 */

const paths = {} as never;
const ids = (items: StaffBarItem[]) => items.map((i) => (i.kind === "registrar" ? REGISTRAR_SLOT.id : i.slot.id));

describe("staffBottomBar", () => {
  it("modo completo: Hoje, Obras, Registrar, Pendências", () => {
    const bar = staffBottomBar({ simple: false, obrasPath: STAFF_OBRAS_LEGADO });
    expect(ids(bar)).toEqual(["hoje", "obras", "registrar", "pendencias"]);
  });

  it("modo simples: mantém Obras, Semana e Hoje e ganha o Registrar", () => {
    const bar = staffBottomBar({ simple: true, obrasPath: STAFF_OBRAS_NOVO });
    expect(ids(bar)).toEqual(["obras-simples", "semana", "registrar", "hoje"]);
  });

  it("o Registrar fica no meio dos cinco espaços (o Perfil é o último)", () => {
    for (const simple of [true, false]) {
      const bar = staffBottomBar({ simple, obrasPath: STAFF_OBRAS_LEGADO });
      expect(bar).toHaveLength(4);
      expect(bar[2]).toEqual({ kind: "registrar" });
    }
  });

  it("modo simples: Obras segue a tela escolhida pela flag", () => {
    const destino = (obrasPath: string) => {
      const item = staffBottomBar({ simple: true, obrasPath })[0];
      return item.kind === "link" ? item.slot.to({ paths, hasProject: false }) : null;
    };
    expect(destino(STAFF_OBRAS_NOVO)).toBe("/gestao/obras");
    expect(destino(STAFF_OBRAS_LEGADO)).toBe("/gestao/painel-obras");
  });

  it("destinos do modo completo, dentro e fora de uma obra", () => {
    const destinos = (ctx: { projectId?: string; lastProjectId?: string }) =>
      Object.fromEntries(STAFF_NAV.map((s) => [s.id, s.to({ paths, hasProject: !!ctx.projectId, ...ctx })]));
    expect(destinos({ projectId: "p1" })).toEqual({
      hoje: "/gestao/hoje",
      obras: "/gestao/painel-obras",
      pendencias: "/obra/p1/pendencias",
    });
    expect(destinos({ lastProjectId: "p9" })).toEqual({
      hoje: "/gestao/hoje",
      obras: "/gestao/painel-obras",
      pendencias: "/obra/p9/pendencias",
    });
    expect(destinos({})).toEqual({
      hoje: "/gestao/hoje",
      obras: "/gestao/painel-obras",
      pendencias: "/gestao/nao-conformidades",
    });
  });
});

describe("resolveActiveStaffSlotId", () => {
  const ctx = { paths, hasProject: true, projectId: "p1" };
  const ativa = (pathname: string) => resolveActiveStaffSlotId(STAFF_NAV, pathname, ctx);

  it("lista de obras e tudo dentro de uma obra acendem Obras", () => {
    expect(ativa("/gestao/painel-obras")).toBe("obras");
    expect(ativa("/gestao/obras")).toBe("obras");
    expect(ativa("/obra/p1")).toBe("obras");
    expect(ativa("/obra/p1/etapas")).toBe("obras");
    expect(ativa("/obra/p1/relatorio-semana")).toBe("obras");
    expect(ativa("/obra/outra/cronograma")).toBe("obras");
  });

  it("Pendências da obra acende só Pendências", () => {
    expect(ativa("/obra/p1/pendencias")).toBe("pendencias");
  });

  it("Hoje acende Hoje; rota sem aba não acende nada", () => {
    expect(ativa("/gestao/hoje")).toBe("hoje");
    expect(ativa("/gestao/semana")).toBeNull();
    expect(ativa("/gestao/hoje-nao")).toBeNull();
  });

  it("modo simples: a obra continua sendo Obras", () => {
    const simples = staffBottomBar({ simple: true, obrasPath: STAFF_OBRAS_NOVO }).flatMap((i) =>
      i.kind === "link" ? [i.slot] : [],
    );
    expect(resolveActiveStaffSlotId(simples, "/obra/p1/etapas", ctx)).toBe("obras-simples");
    expect(resolveActiveStaffSlotId(simples, "/gestao/semana", ctx)).toBe("semana");
  });
});

describe("CLIENT_NAV não mudou", () => {
  it("mesmas abas, rótulos e regras de ativo", () => {
    expect(
      CLIENT_NAV.map((s) => ({
        id: s.id,
        label: s.label,
        badge: s.badge,
        end: s.end ?? false,
        matchReportHub: s.matchReportHub ?? false,
        alsoActiveOn: s.alsoActiveOn ?? null,
      })),
    ).toEqual([
      { id: "obra", label: "Obra", badge: "none", end: true, matchReportHub: true, alsoActiveOn: null },
      { id: "financeiro", label: "Financeiro", badge: "none", end: false, matchReportHub: false, alsoActiveOn: null },
      { id: "documentos", label: "Documentos", badge: "none", end: false, matchReportHub: false, alsoActiveOn: null },
      { id: "formalizacoes", label: "Acordos", badge: "none", end: false, matchReportHub: false, alsoActiveOn: null },
    ]);
  });

  it("mesmos ícones", () => {
    expect(CLIENT_NAV.map((s) => s.icon)).toEqual([Building2, DollarSign, FolderOpen, ClipboardSignature]);
  });

  it("mesmos destinos: obra da URL, última obra visitada e sem obra", () => {
    const destinos = (ctx: { projectId?: string; lastProjectId?: string }) =>
      CLIENT_NAV.map((s) => s.to({ paths, hasProject: !!ctx.projectId, ...ctx }));
    expect(destinos({ projectId: "p1", lastProjectId: "p9" })).toEqual([
      "/obra/p1",
      "/obra/p1/financeiro",
      "/obra/p1/documentos",
      "/obra/p1/formalizacoes",
    ]);
    expect(destinos({ lastProjectId: "p9" })).toEqual([
      "/obra/p9",
      "/obra/p9/financeiro",
      "/obra/p9/documentos",
      "/obra/p9/formalizacoes",
    ]);
    expect(destinos({})).toEqual(["/minhas-obras", "/minhas-obras", "/minhas-obras", "/minhas-obras"]);
  });

  it("o cliente não tem Registrar, Hoje nem Pendências da equipe", () => {
    const clientIds = CLIENT_NAV.map((s) => s.id);
    expect(clientIds).not.toContain(REGISTRAR_SLOT.id);
    expect(clientIds).not.toContain("hoje");
    expect(clientIds).not.toContain("pendencias");
  });
});
