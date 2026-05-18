/**
 * Behavioral tests for ProjectRouteTransition.
 *
 * These cover the two UX guarantees the mobile navigation depends on:
 *  1. On a route change, the scroll position is reset on the correct
 *     container — the provided `scrollTargetRef` when set (staff <main>),
 *     and `window` as fallback (client layout scrolls the document).
 *  2. The fade-in animation is suppressed when the user prefers reduced
 *     motion; the scroll reset still happens regardless.
 *
 * We use Vitest + Testing Library with a `MemoryRouter` rather than full
 * Playwright E2E because the affected routes live inside the authenticated
 * project shell. A unit-level test is faster, deterministic, and exercises
 * the exact branch the user reported issues on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { ProjectRouteTransition } from "../ProjectRouteTransition";

/** Helper: triggers navigation from inside the router tree. */
function Navigator({ to }: { to: string | null }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (to) navigate(to);
  }, [to, navigate]);
  return null;
}

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("ProjectRouteTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resets scroll on the provided scrollTargetRef when the route changes", async () => {
    const scrollSpy = vi.fn();

    function Harness({ navigateTo }: { navigateTo: string | null }) {
      const mainRef = useRef<HTMLElement>(null);
      // Patch the scroll method as soon as the ref is attached so we capture
      // the call the transition triggers on pathname change.
      useEffect(() => {
        if (mainRef.current) {
          mainRef.current.scrollTo = scrollSpy as unknown as typeof window.scrollTo;
        }
      }, []);

      return (
        <main ref={mainRef} data-testid="scroll-container">
          <Navigator to={navigateTo} />
          <ProjectRouteTransition scrollTargetRef={mainRef}>
            <Routes>
              <Route path="/obra/1/financeiro" element={<div>Financeiro</div>} />
              <Route path="/obra/1/documentos" element={<div>Documentos</div>} />
            </Routes>
          </ProjectRouteTransition>
        </main>
      );
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo={null} />
      </MemoryRouter>,
    );

    // No navigation yet -> no scroll reset.
    expect(scrollSpy).not.toHaveBeenCalled();

    // Trigger a route change to a sibling tab.
    rerender(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo="/obra/1/documentos" />
      </MemoryRouter>,
    );

    // Container's scrollTo must be invoked with top: 0 on pathname change.
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  });

  it("falls back to window scroll when no scrollTargetRef is provided", () => {
    const windowScrollSpy = vi.fn();
    const originalScrollTo = window.scrollTo;
    window.scrollTo = windowScrollSpy as unknown as typeof window.scrollTo;

    function Harness({ navigateTo }: { navigateTo: string | null }) {
      return (
        <>
          <Navigator to={navigateTo} />
          <ProjectRouteTransition>
            <Routes>
              <Route path="/obra/1" element={<div>Hub</div>} />
              <Route path="/obra/1/financeiro" element={<div>Financeiro</div>} />
            </Routes>
          </ProjectRouteTransition>
        </>
      );
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={["/obra/1"]}>
        <Harness navigateTo={null} />
      </MemoryRouter>,
    );
    expect(windowScrollSpy).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter initialEntries={["/obra/1"]}>
        <Harness navigateTo="/obra/1/financeiro" />
      </MemoryRouter>,
    );

    expect(windowScrollSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    window.scrollTo = originalScrollTo;
  });

  it("applies animate-fade-in by default after the skeleton resolves", () => {
    function Harness({ navigateTo }: { navigateTo: string | null }) {
      return (
        <>
          <Navigator to={navigateTo} />
          <ProjectRouteTransition>
            <Routes>
              <Route
                path="/obra/1/financeiro"
                element={<div data-testid="content">Financeiro</div>}
              />
              <Route
                path="/obra/1/documentos"
                element={<div data-testid="content">Documentos</div>}
              />
            </Routes>
          </ProjectRouteTransition>
        </>
      );
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo={null} />
      </MemoryRouter>,
    );

    rerender(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo="/obra/1/documentos" />
      </MemoryRouter>,
    );

    // While the swap skeleton is up, content is not rendered yet.
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();

    // After the skeleton's minimum time, content paints with fade-in.
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const content = screen.getByTestId("content");
    const wrapper = content.parentElement!;
    expect(wrapper).toHaveClass("animate-fade-in");
  });

  it("omits the fade-in class when prefers-reduced-motion is set, but still resets scroll", () => {
    setReducedMotion(true);
    const windowScrollSpy = vi.fn();
    const originalScrollTo = window.scrollTo;
    window.scrollTo = windowScrollSpy as unknown as typeof window.scrollTo;

    function Harness({ navigateTo }: { navigateTo: string | null }) {
      return (
        <>
          <Navigator to={navigateTo} />
          <ProjectRouteTransition>
            <Routes>
              <Route
                path="/obra/1/financeiro"
                element={<div data-testid="content">Financeiro</div>}
              />
              <Route
                path="/obra/1/documentos"
                element={<div data-testid="content">Documentos</div>}
              />
            </Routes>
          </ProjectRouteTransition>
        </>
      );
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo={null} />
      </MemoryRouter>,
    );

    rerender(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo="/obra/1/documentos" />
      </MemoryRouter>,
    );

    // Scroll reset must still happen for reduced-motion users.
    expect(windowScrollSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const content = screen.getByTestId("content");
    const wrapper = content.parentElement!;
    expect(wrapper).not.toHaveClass("animate-fade-in");

    window.scrollTo = originalScrollTo;
  });
});
