import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const flags: Record<string, boolean> = {};
let simple = false;
vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ isEnabled: (k: string) => flags[k] ?? false, isLoading: false }),
}));
vi.mock("@/hooks/useMenuMode", () => ({ useMenuMode: () => ({ isSimple: simple }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ loading: false }) }));

import { GestaoHomeRedirect } from "../GestaoHomeRedirect";

function Onde() {
  return <output data-testid="onde">{useLocation().pathname}</output>;
}
const go = () =>
  render(
    <MemoryRouter initialEntries={["/gestao"]}>
      <Routes>
        <Route path="/gestao" element={<GestaoHomeRedirect />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );

describe("GestaoHomeRedirect", () => {
  it("com a tela 'O que fazer' ligada, todo mundo entra nela", () => {
    flags.telaOQueFazer = true;
    simple = true;
    go();
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/o-que-fazer");
  });
  it("desligada, volta à regra antiga", () => {
    flags.telaOQueFazer = false;
    simple = false;
    go();
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/painel-obras");
  });
});
