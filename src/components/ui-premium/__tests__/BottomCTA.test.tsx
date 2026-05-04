import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomCTA } from "../BottomCTA";

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
};

describe("BottomCTA", () => {
  beforeEach(() => {
    setInnerWidth(1280);
    setMatchMedia(false);
  });

  it("renders the primary action label", () => {
    render(<BottomCTA primary={{ label: "Salvar" }} mode="fixed" />);
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("invokes the primary onClick handler", () => {
    const onClick = vi.fn();
    render(
      <BottomCTA primary={{ label: "Confirmar", onClick }} mode="fixed" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders both primary and secondary buttons when secondary is provided", () => {
    render(
      <BottomCTA
        primary={{ label: "Salvar" }}
        secondary={{ label: "Cancelar" }}
        mode="fixed"
      />,
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("disables the button while loading and shows the spinner", () => {
    render(
      <BottomCTA primary={{ label: "Salvar", loading: true }} mode="fixed" />,
    );
    const button = screen.getByRole("button", { name: /salvar/i });
    expect(button).toBeDisabled();
  });

  it("renders a fixed bar in mobile mode", () => {
    setInnerWidth(375);
    setMatchMedia(true);
    render(<BottomCTA primary={{ label: "Acao" }} />);
    expect(
      document.querySelector('[data-component="bottom-cta"]'),
    ).not.toBeNull();
  });

  it("renders inline (no fixed bar) in desktop mode", () => {
    setInnerWidth(1280);
    setMatchMedia(false);
    render(<BottomCTA primary={{ label: "Acao" }} mode="inline" />);
    expect(document.querySelector('[data-component="bottom-cta"]')).toBeNull();
  });
});
