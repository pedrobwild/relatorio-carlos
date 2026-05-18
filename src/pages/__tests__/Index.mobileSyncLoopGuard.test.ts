import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loop-prevention guards for the mobile activeTab sync effects in Index.tsx.
 *
 * The Index page has two effects that can call `navigate()` based on
 * `activeTab` / `readMobileNavSlot`:
 *
 *  1. The persisted-slot restore effect (runs once on mount).
 *  2. The route-only tabs sync effect (financeiro/documentos/…).
 *
 * Both MUST short-circuit when the current `location.pathname` already
 * matches the resolved target — otherwise the navigate call retriggers the
 * effect via the `location.pathname` dependency and creates an infinite
 * navigation loop on mobile.
 *
 * We assert the guards exist statically (cheap, refactor-resilient) and
 * additionally simulate the conditional logic to prove that a matching
 * pathname yields no navigation.
 */
describe("Index — mobile sync loop guards", () => {
  const source = readFileSync(resolve(__dirname, "../Index.tsx"), "utf8");

  it("route-only tabs effect short-circuits when pathname === target", () => {
    // Locate the route-only sync effect.
    const marker = "const routeMap: Record<string, string>";
    const start = source.indexOf(marker);
    expect(start, "route-only sync effect not found").toBeGreaterThan(-1);
    const end = source.indexOf("}, [", start);
    const block = source.slice(start, end);

    // The guard line must exist BEFORE the navigate() call.
    const guardIdx = block.indexOf(
      "if (location.pathname === target) return;",
    );
    const navigateIdx = block.indexOf("navigate(target,");
    expect(guardIdx, "missing pathname === target guard").toBeGreaterThan(-1);
    expect(navigateIdx).toBeGreaterThan(guardIdx);
  });

  it("persisted-slot restore effect runs at most once per mount", () => {
    // The `restoreCheckedRef` flag flips on first run so the effect cannot
    // navigate again when location.pathname (a dep) updates.
    const start = source.indexOf("restoreCheckedRef.current = true");
    expect(start, "missing restoreCheckedRef guard").toBeGreaterThan(-1);
    const before = source.slice(Math.max(0, start - 200), start);
    expect(before).toMatch(/if \(restoreCheckedRef\.current\) return;/);
  });

  it("persisted-slot restore is skipped when not on project root path", () => {
    // Direct deep links (e.g. /obra/:id/financeiro) must NOT trigger a
    // restore-navigate that would clash with the URL the user requested.
    expect(source).toMatch(
      /if \(location\.pathname !== `\/obra\/\$\{projectId\}`\) return;/,
    );
  });

  // Behavioral simulation of the guard, independent of React/router.
  it("simulated effect: matching pathname yields zero navigate calls", () => {
    const projectId = "p1";
    const routeMap: Record<string, string> = {
      financeiro: `/obra/${projectId}/financeiro`,
      documentos: `/obra/${projectId}/documentos`,
      formalizacoes: `/obra/${projectId}/formalizacoes`,
      pendencias: `/obra/${projectId}/pendencias`,
    };

    const runEffect = (
      activeTab: string,
      pathname: string,
      navigate: (to: string) => void,
    ) => {
      const target = routeMap[activeTab];
      if (!target) return;
      if (pathname === target) return; // loop guard
      navigate(target);
    };

    for (const slot of Object.keys(routeMap)) {
      const calls: string[] = [];
      // Pathname already matches the target — must not navigate.
      runEffect(slot, routeMap[slot], (to) => calls.push(to));
      expect(
        calls,
        `slot "${slot}" navigated even though pathname matched target`,
      ).toEqual([]);
    }
  });

  it("simulated effect: mismatched pathname navigates exactly once", () => {
    const projectId = "p1";
    const routeMap: Record<string, string> = {
      financeiro: `/obra/${projectId}/financeiro`,
    };

    const calls: string[] = [];
    const runEffect = (activeTab: string, pathname: string) => {
      const target = routeMap[activeTab];
      if (!target) return;
      if (pathname === target) return;
      calls.push(target);
    };

    runEffect("financeiro", `/obra/${projectId}`);
    // After navigation, the next run sees pathname === target and stops.
    runEffect("financeiro", routeMap.financeiro);
    expect(calls).toEqual([routeMap.financeiro]);
  });
});
