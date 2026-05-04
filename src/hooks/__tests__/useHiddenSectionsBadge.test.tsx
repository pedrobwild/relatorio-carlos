import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";
import { useHiddenSectionsBadge } from "@/hooks/useHiddenSectionsBadge";

const mockStats = {
  total: 0,
  overdueCount: 0,
  urgentCount: 0,
  byType: { signature: 0, invoice: 0 } as Record<string, number>,
};

vi.mock("@/hooks/usePendencias", () => ({
  usePendencias: () => ({ stats: mockStats }),
}));

const wrapper =
  (initialRoute: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/obra/:projectId/*" element={children} />
      </Routes>
    </MemoryRouter>
  );

describe("useHiddenSectionsBadge", () => {
  beforeEach(() => {
    mockStats.byType.signature = 0;
    mockStats.byType.invoice = 0;
    mockStats.overdueCount = 0;
    mockStats.urgentCount = 0;
  });

  it("returns 0 when there are no pendencies", () => {
    const { result } = renderHook(
      () => useHiddenSectionsBadge(["/obra/p1/financeiro", "/obra/p1/pendencias"]),
      { wrapper: wrapper("/obra/p1/jornada") },
    );
    expect(result.current).toBe(0);
  });

  it("includes signature count when formalizacoes is hidden from main bar", () => {
    mockStats.byType.signature = 3;
    const { result } = renderHook(
      () =>
        useHiddenSectionsBadge([
          "/obra/p1/cronograma",
          "/obra/p1/financeiro",
          "/obra/p1/pendencias",
        ]),
      { wrapper: wrapper("/obra/p1/cronograma") },
    );
    expect(result.current).toBe(3);
  });

  it("excludes financeiro count when financeiro IS in main bar", () => {
    mockStats.byType.invoice = 5;
    const { result } = renderHook(
      () =>
        useHiddenSectionsBadge([
          "/obra/p1/cronograma",
          "/obra/p1/financeiro",
          "/obra/p1/pendencias",
        ]),
      { wrapper: wrapper("/obra/p1/cronograma") },
    );
    expect(result.current).toBe(0);
  });

  it("includes overdue+urgent when pendencias is hidden", () => {
    mockStats.overdueCount = 2;
    mockStats.urgentCount = 4;
    const { result } = renderHook(
      () => useHiddenSectionsBadge(["/obra/p1/cronograma"]),
      { wrapper: wrapper("/obra/p1/cronograma") },
    );
    expect(result.current).toBe(6);
  });

  it("sums multiple hidden sections", () => {
    mockStats.byType.signature = 1;
    mockStats.byType.invoice = 2;
    mockStats.overdueCount = 1;
    mockStats.urgentCount = 1;
    const { result } = renderHook(
      () => useHiddenSectionsBadge(["/obra/p1/cronograma"]),
      { wrapper: wrapper("/obra/p1/cronograma") },
    );
    // signature(1) + invoice(2) + overdue(1) + urgent(1) = 5
    expect(result.current).toBe(5);
  });
});
