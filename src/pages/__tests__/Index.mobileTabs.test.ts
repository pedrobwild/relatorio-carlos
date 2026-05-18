import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Static guard: the customer portal mobile bottom-nav owns Financeiro,
 * Documentos, Formalizações and Pendências. The top TabsList must therefore
 * hide those four triggers on mobile (`hidden md:inline-flex`) and keep
 * Cronograma, Evolução de Obra and Relatórios always visible.
 *
 * We assert the JSX shape directly so the rule survives refactors of the
 * heavy Index page (which would otherwise be expensive to render in jsdom).
 */
describe("Index — mobile tabs visibility", () => {
  const source = readFileSync(
    resolve(__dirname, "../Index.tsx"),
    "utf8",
  );

  // Restrict to the customer branch (the `hasShell ? ... : (...)` else block).
  // The staff branch is intentionally limited to 3 dashboard tabs and is
  // never shown on the customer mobile portal.
  const clientBranchStart = source.indexOf("/* Staff with sidebar");
  const clientBranchEnd = source.indexOf("</TabsList>", clientBranchStart);
  const clientBranch = source.slice(clientBranchStart, clientBranchEnd);

  const triggerBlocks = clientBranch
    .split("<TabsTrigger")
    .slice(1)
    .map((chunk) => "<TabsTrigger" + chunk.split("</TabsTrigger>")[0]);

  const findTrigger = (value: string) =>
    triggerBlocks.find((block) => block.includes(`value="${value}"`));

  const baseTabs = ["cronograma", "evolucao", "relatorios"];
  const bottomNavTabs = [
    "financeiro",
    "documentos",
    "formalizacoes",
    "pendencias",
  ];

  it("renders the three base tabs in the customer branch", () => {
    for (const value of baseTabs) {
      expect(findTrigger(value), `expected trigger value="${value}"`).toBeTruthy();
    }
  });

  it("renders the four bottom-nav tabs in the customer branch", () => {
    for (const value of bottomNavTabs) {
      expect(findTrigger(value), `expected trigger value="${value}"`).toBeTruthy();
    }
  });

  it("keeps Cronograma, Evolução and Relatórios visible on mobile (no `hidden` class)", () => {
    for (const value of baseTabs) {
      const trigger = findTrigger(value)!;
      // The base tab must NOT be hidden below md.
      expect(
        /className="portal-tab-trigger"/.test(trigger) ||
          /className="portal-tab-trigger\s+[^"]*"/.test(trigger),
        `trigger "${value}" should not use a hidden modifier`,
      ).toBe(true);
      expect(trigger).not.toMatch(/hidden md:inline-flex/);
    }
  });

  it("hides Financeiro, Documentos, Formalizações and Pendências below md", () => {
    for (const value of bottomNavTabs) {
      const trigger = findTrigger(value)!;
      expect(
        trigger,
        `trigger "${value}" must include "hidden md:inline-flex"`,
      ).toMatch(/className="portal-tab-trigger hidden md:inline-flex"/);
    }
  });
});
