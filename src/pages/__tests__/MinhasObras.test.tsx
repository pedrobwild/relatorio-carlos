import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const projectsFixture = [
  {
    id: "1",
    name: "Test Project",
    unit_name: "Unit A",
    status: "active",
    planned_start_date: null, // Null date - should not crash
    planned_end_date: null, // Null date - should not crash
    actual_start_date: null,
    created_at: "2025-01-01",
    is_project_phase: false,
  },
  {
    id: "2",
    name: "Valid Project",
    unit_name: "Unit B",
    status: "active",
    planned_start_date: "2025-01-01",
    planned_end_date: "2025-06-01",
    actual_start_date: "2025-01-15",
    created_at: "2025-01-01",
    is_project_phase: true,
  },
];

// Mock dependencies. useClientDashboard pulls useProjectSummaryQuery from
// useProjectsQuery, so we have to stub that export as well or imports break.
vi.mock("@/hooks/useProjectsQuery", () => ({
  useProjectsQuery: () => ({
    data: projectsFixture,
    isLoading: false,
    error: null,
  }),
  useProjectSummaryQuery: () => ({
    data: projectsFixture,
    isLoading: false,
    error: null,
  }),
  projectKeys: {
    all: ["projects"],
    lists: () => ["projects", "list"],
    list: (filters?: unknown) => ["projects", "list", filters],
    details: () => ["projects", "detail"],
    detail: (id: string) => ["projects", "detail", id],
    summary: (userId?: string) => ["projects", "summary", userId],
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    role: "customer",
    loading: false,
    isStaff: false,
    isCustomer: true,
  }),
}));

// Import after mocks
import MinhasObras from "../MinhasObras";

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("MinhasObras", () => {
  it("should render without crashing when projects have null dates", () => {
    expect(() => {
      render(<MinhasObras />, { wrapper: Wrapper });
    }).not.toThrow();
  });

  it("renders project names from the dashboard payload", () => {
    const { container } = render(<MinhasObras />, { wrapper: Wrapper });

    expect(container.textContent).toContain("Test Project");
    expect(container.textContent).toContain("Valid Project");
  });

  it("renders the dashboard header for the customer portal", () => {
    const { container } = render(<MinhasObras />, { wrapper: Wrapper });

    expect(container.textContent).toContain("Portal do Cliente");
    expect(container.textContent).toContain("Meu Painel");
  });
});
