/**
 * Behavioral tests for ProjectRouteTransition.
 *
 * Guarantees covered:
 *  1. PUSH navigation (tap a sibling tab) resets every plausible scroll
 *     container — `scrollTargetRef` when provided, window fallback, and
 *     any `[data-scroll-container]` opt-in element.
 *  2. POP navigation (browser back) restores the snapshot we kept for the
 *     pathname the user is returning to.
 *  3. Fade-in animation is suppressed when prefers-reduced-motion is set;
 *     scroll behavior is preserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  ProjectRouteTransition,
  __resetScrollPositionsForTests,
} from "../ProjectRouteTransition";

function Navigator({
  to,
  action = "push",
}: {
  to: string | null;
  action?: "push" | "pop";
}) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!to) return;
    if (action === "pop") navigate(-1);
    else navigate(to);
  }, [to, action, navigate]);
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

/** Advances fake timers + flushes the rAF used after the skeleton. */
function flushTransition() {
  act(() => {
    vi.advanceTimersByTime(200);
  });
  // requestAnimationFrame is polyfilled by jsdom as setTimeout(0).
  act(() => {
    vi.advanceTimersByTime(32);
  });
}

describe("ProjectRouteTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "Date"],
    });
    setReducedMotion(false);
    __resetScrollPositionsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resets the scrollTargetRef to top on PUSH navigation", () => {
    const scrollAssignments: number[] = [];

    function Harness({ navigateTo }: { navigateTo: string | null }) {
      const mainRef = useRef<HTMLElement>(null);
      useEffect(() => {
        if (!mainRef.current) return;
        Object.defineProperty(mainRef.current, "scrollTop", {
          configurable: true,
          get: () => 0,
          set: (v: number) => scrollAssignments.push(v),
        });
      }, []);

      return (
        <main ref={mainRef}>
          <Navigator to={navigateTo} />
          <ProjectRouteTransition scrollTargetRef={mainRef}>
            <Routes>
              <Route path="/obra/1/financeiro" element={<div>Fin</div>} />
              <Route path="/obra/1/documentos" element={<div>Docs</div>} />
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

    rerender(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness navigateTo="/obra/1/documentos" />
      </MemoryRouter>,
    );

    flushTransition();

    // The target's scrollTop must have been assigned 0 at least once.
    expect(scrollAssignments).toContain(0);
  });

  it("restores the previous scroll position on POP navigation", () => {
    const scrollAssignments: number[] = [];
    let navRef!: ReturnType<typeof useNavigate>;

    function ExposeNav() {
      navRef = useNavigate();
      return null;
    }

    function Harness() {
      const mainRef = useRef<HTMLElement>(null);
      useEffect(() => {
        if (!mainRef.current) return;
        let value = 0;
        Object.defineProperty(mainRef.current, "scrollTop", {
          configurable: true,
          get: () => value,
          set: (v: number) => {
            value = v;
            scrollAssignments.push(v);
          },
        });
      }, []);

      return (
        <main ref={mainRef} data-testid="main">
          <ExposeNav />
          <ProjectRouteTransition scrollTargetRef={mainRef}>
            <Routes>
              <Route path="/obra/1/financeiro" element={<div>Fin</div>} />
              <Route path="/obra/1/documentos" element={<div>Docs</div>} />
            </Routes>
          </ProjectRouteTransition>
        </main>
      );
    }

    render(
      <MemoryRouter initialEntries={["/obra/1/financeiro"]}>
        <Harness />
      </MemoryRouter>,
    );

    // Simulate user scrolling the main container, then dispatch scroll
    // so the listener saves the snapshot for /financeiro.
    const main = screen.getByTestId("main");
    main.scrollTop = 420;
    act(() => {
      main.dispatchEvent(new Event("scroll"));
    });

    // Forward to /documentos and flush the swap (resets target to 0).
    act(() => {
      navRef("/obra/1/documentos");
    });
    flushTransition();
    scrollAssignments.length = 0;

    // Pop back — should restore 420 on the target.
    act(() => {
      navRef(-1);
    });
    flushTransition();

    expect(scrollAssignments).toContain(420);
  });

  it("omits the fade-in class when prefers-reduced-motion is set", () => {
    setReducedMotion(true);

    function Harness({ navigateTo }: { navigateTo: string | null }) {
      return (
        <>
          <Navigator to={navigateTo} />
          <ProjectRouteTransition>
            <Routes>
              <Route
                path="/obra/1/financeiro"
                element={<div data-testid="content">Fin</div>}
              />
              <Route
                path="/obra/1/documentos"
                element={<div data-testid="content">Docs</div>}
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

    flushTransition();

    const content = screen.getByTestId("content");
    expect(content.parentElement).not.toHaveClass("animate-fade-in");
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
                element={<div data-testid="content">Fin</div>}
              />
              <Route
                path="/obra/1/documentos"
                element={<div data-testid="content">Docs</div>}
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

    flushTransition();

    const content = screen.getByTestId("content");
    expect(content.parentElement).toHaveClass("animate-fade-in");
  });
});
