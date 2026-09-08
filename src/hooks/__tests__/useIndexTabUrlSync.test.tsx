import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect, useState } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { BrowserRouter, useNavigate, useSearchParams } from "react-router-dom";
import { useIndexTabUrlSync } from "../useIndexTabUrlSync";

vi.mock("@/lib/amplitude", () => ({ trackAmplitude: vi.fn() }));

const VISIBLE = ["cronograma", "evolucao", "relatorios"] as const;
const PROJECT = "p1";
const STORAGE_KEY = `mobileActiveTab:${PROJECT}`;

/**
 * Reproduz a Index: `activeTab` vive num estado externo (useProjectPortal),
 * que também restaura a aba salva no viewState num efeito próprio — declarado
 * ANTES do hook, como no componente real, para cair no mesmo commit.
 */
function Harness({
  initialTab = "cronograma",
  restoreTo,
  isMobile = true,
  enabled = true,
}: {
  initialTab?: string;
  restoreTo?: string;
  isMobile?: boolean;
  enabled?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    if (restoreTo) setActiveTab(restoreTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useIndexTabUrlSync({
    projectId: PROJECT,
    activeTab,
    setActiveTab,
    visibleTabs: VISIBLE,
    isMobile,
    enabled,
  });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="tab">{activeTab}</span>
      <span data-testid="url">{params.get("tab") ?? "(none)"}</span>
      <button onClick={() => setActiveTab("evolucao")}>user:evolucao</button>
      <button onClick={() => navigate("?tab=relatorios")}>
        external:relatorios
      </button>
    </div>
  );
}

function renderAt(url: string, props: React.ComponentProps<typeof Harness> = {}) {
  // O history do react-router grava `idx` no state ao iniciar quando ele não
  // existe — uma chamada a replaceState que não é do hook. Pré-semear evita
  // contaminar a contagem.
  window.history.replaceState({ idx: 0 }, "", url);
  const replaceSpy = vi.spyOn(window.history, "replaceState");
  const utils = render(
    <BrowserRouter>
      <Harness {...props} />
    </BrowserRouter>,
  );
  return { ...utils, replaceSpy };
}

const settle = () => new Promise((r) => setTimeout(r, 50));

describe("useIndexTabUrlSync — sem laço de replaceState", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("deep link ?tab=relatorios com viewState divergente: adota a URL e não oscila", async () => {
    // Antes: E1 adotava 'relatorios' enquanto E2, no mesmo commit, gravava o
    // default 'cronograma' na URL — e os dois se readotavam para sempre.
    const { replaceSpy } = renderAt(`/obra/${PROJECT}?tab=relatorios`, {
      restoreTo: "evolucao",
    });
    await waitFor(() =>
      expect(screen.getByTestId("tab").textContent).toBe("relatorios"),
    );
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("relatorios");
    expect(screen.getByTestId("url").textContent).toBe("relatorios");
    expect(replaceSpy.mock.calls.length).toBeLessThanOrEqual(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("relatorios");
  });

  it("mobile sem ?tab: restaura a aba do localStorage e espelha na URL uma vez", async () => {
    localStorage.setItem(STORAGE_KEY, "relatorios");
    const { replaceSpy } = renderAt(`/obra/${PROJECT}`);
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("relatorios"),
    );
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("relatorios");
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("relatorios");
  });

  it("mobile sem ?tab com localStorage e viewState divergentes: converge sem laço", async () => {
    localStorage.setItem(STORAGE_KEY, "relatorios");
    const { replaceSpy } = renderAt(`/obra/${PROJECT}`, {
      restoreTo: "evolucao",
    });
    await act(settle);
    const tab = screen.getByTestId("tab").textContent;
    expect(VISIBLE).toContain(tab);
    expect(screen.getByTestId("url").textContent).toBe(tab);
    expect(replaceSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("desktop sem ?tab: viewState restaurado no mesmo commit vence e vai para a URL", async () => {
    const { replaceSpy } = renderAt(`/obra/${PROJECT}`, {
      isMobile: false,
      restoreTo: "relatorios",
    });
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("relatorios"),
    );
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("relatorios");
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it("troca de aba pelo usuário espelha em ?tab= e no storage", async () => {
    const { replaceSpy } = renderAt(`/obra/${PROJECT}?tab=cronograma`);
    await act(settle);
    replaceSpy.mockClear();
    await act(async () => {
      screen.getByText("user:evolucao").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("evolucao"),
    );
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("evolucao");
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("evolucao");
  });

  it("mudança externa da URL (voltar/avançar, link) é adotada sem reescrever a URL", async () => {
    const { replaceSpy } = renderAt(`/obra/${PROJECT}?tab=cronograma`);
    await act(settle);
    replaceSpy.mockClear();
    await act(async () => {
      screen.getByText("external:relatorios").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("tab").textContent).toBe("relatorios"),
    );
    await act(settle);
    expect(screen.getByTestId("url").textContent).toBe("relatorios");
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("desabilitado (obra em fase de projeto): não toca na URL nem no estado", async () => {
    localStorage.setItem(STORAGE_KEY, "relatorios");
    const { replaceSpy } = renderAt(`/obra/${PROJECT}?tab=evolucao`, {
      enabled: false,
    });
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("cronograma");
    expect(screen.getByTestId("url").textContent).toBe("evolucao");
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("?tab= inválido é ignorado e não é sobrescrito no primeiro commit", async () => {
    const { replaceSpy } = renderAt(`/obra/${PROJECT}?tab=financeiro`);
    await act(settle);
    expect(screen.getByTestId("tab").textContent).toBe("cronograma");
    // A URL tem um tab que não é da Index: espelhar o estado por cima é o
    // comportamento anterior e é aceitável, mas nunca em laço.
    expect(replaceSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
