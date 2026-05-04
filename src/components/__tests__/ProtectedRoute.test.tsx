import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  ProtectedRoute,
  StaffRoute,
  CustomerRoute,
} from "@/components/ProtectedRoute";

// Mock hooks
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUserRole = vi.mocked(useUserRole);

const TestComponent = () => (
  <div data-testid="protected-content">Protected Content</div>
);

const STAFF_ROLES: AppRole[] = [
  "engineer",
  "manager",
  "admin",
  "gestor",
  "suprimentos",
  "financeiro",
  "cs",
  "arquitetura",
];

// Helper to create mock role state — espelha a lógica real de useUserRole.ts
const createMockRoleState = (roles: AppRole[], loading = false) => ({
  roles,
  role: roles[0] || null,
  loading,
  isStaff: roles.some((r) => STAFF_ROLES.includes(r)),
  isCustomer: roles.includes("customer"),
  isAdmin: roles.includes("admin"),
  isManager: roles.includes("manager"),
  hasRole: (role: AppRole) => roles.includes(role),
  hasAnyRole: (checkRoles: AppRole[]) =>
    checkRoles.some((r) => roles.includes(r)),
});

const mockAuthed = () => {
  mockedUseAuth.mockReturnValue({
    isAuthenticated: true,
    loading: false,
    user: { id: "user-123", email: "test@example.com" } as any,
    session: {} as any,
    signOut: vi.fn(),
  });
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading spinner when auth is loading", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState([], true));

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("should redirect to /auth when not authenticated", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState([]));

    const { queryByTestId } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("should render children when authenticated", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(["customer"]));

    const { getByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it("should redirect customer to /minhas-obras when accessing staff routes", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(["customer"]));

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["engineer", "admin"]}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("should redirect staff to /gestao when accessing customer routes", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(["engineer"]));

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["customer"]}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("should allow access when user has at least one of multiple allowed roles", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    // User has both admin and engineer roles
    mockedUseUserRole.mockReturnValue(
      createMockRoleState(["admin", "engineer"]),
    );

    const { getByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["admin"]}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it("should allow access when user has multiple roles and one matches", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    // User has customer and engineer roles
    mockedUseUserRole.mockReturnValue(
      createMockRoleState(["customer", "engineer"]),
    );

    const { getByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["engineer", "manager"]}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });
});

describe("StaffRoute", () => {
  it("should allow engineers access", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(["engineer"]));

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it("should allow admins access", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(["admin"]));

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it("should allow users with multiple roles including staff", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: "user-123", email: "test@example.com" } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(
      createMockRoleState(["admin", "engineer"]),
    );

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });
});

describe("CustomerRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthed();
  });

  it("permite o papel customer", () => {
    mockedUseUserRole.mockReturnValue(createMockRoleState(["customer"]));

    const { getByTestId } = render(
      <MemoryRouter>
        <CustomerRoute>
          <TestComponent />
        </CustomerRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it("bloqueia papéis staff (ex.: arquitetura)", () => {
    mockedUseUserRole.mockReturnValue(createMockRoleState(["arquitetura"]));

    const { queryByTestId } = render(
      <MemoryRouter>
        <CustomerRoute>
          <TestComponent />
        </CustomerRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});

describe("StaffRoute — cobertura completa de papéis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthed();
  });

  it.each(STAFF_ROLES)('permite acesso para o papel staff "%s"', (role) => {
    mockedUseUserRole.mockReturnValue(createMockRoleState([role]));

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(getByTestId("protected-content")).toBeInTheDocument();
  });

  it('bloqueia o papel "customer" no StaffRoute', () => {
    mockedUseUserRole.mockReturnValue(createMockRoleState(["customer"]));

    const { queryByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("bloqueia usuários sem nenhum papel", () => {
    mockedUseUserRole.mockReturnValue(createMockRoleState([]));

    const { queryByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>,
    );

    expect(queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
