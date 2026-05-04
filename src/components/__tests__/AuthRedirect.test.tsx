import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthRedirect } from '@/components/AuthRedirect';

// Mock hooks
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: vi.fn(),
}));

vi.mock('@/lib/debugAuth', () => ({
  debugNav: vi.fn(),
}));

// AuthRedirect calls useProjectsQuery which would need a real QueryClient.
// Stub it so the redirect logic runs without TanStack wiring.
vi.mock('@/hooks/useProjectsQuery', () => ({
  useProjectsQuery: () => ({ data: [], isLoading: false, error: null }),
}));

import { useAuth } from '@/hooks/useAuth';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUserRole = vi.mocked(useUserRole);

// Helper to create mock role state
const createMockRoleState = (roles: AppRole[], loading = false) => ({
  roles,
  role: roles[0] || null,
  loading,
  isStaff: roles.some(r => ['engineer', 'admin', 'manager'].includes(r)),
  isCustomer: roles.includes('customer'),
  isAdmin: roles.includes('admin'),
  isManager: roles.includes('manager'),
  hasRole: (role: AppRole) => roles.includes(role),
  hasAnyRole: (checkRoles: AppRole[]) => checkRoles.some(r => roles.includes(r)),
});

describe('AuthRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner while checking auth', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState([], true));

    const { container } = render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    // Should show loading spinner (has animate-spin class)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should redirect staff to /gestao', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'staff@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['engineer']));

    render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/gestao', { replace: true });
  });

  it('should redirect customers to /minhas-obras', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'customer@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['customer']));

    render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/minhas-obras', { replace: true });
  });

  it('should not redirect when not authenticated', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState([]));

    render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should redirect admins to /gestao', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'admin-123', email: 'admin@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['admin']));

    render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/gestao', { replace: true });
  });

  it('should redirect user with multiple roles (admin+engineer) to /gestao', async () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'multi-role-123', email: 'multi@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['admin', 'engineer']));

    render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/gestao', { replace: true });
  });

  it('should reset redirect flag when role changes (logout/login scenario)', async () => {
    // First render: staff user
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-1', email: 'staff@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['engineer']));

    const { rerender } = render(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/gestao', { replace: true });
    mockNavigate.mockClear();

    // Simulate user change: now a customer
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-2', email: 'customer@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue(createMockRoleState(['customer']));

    rerender(
      <MemoryRouter>
        <AuthRedirect />
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // BUG FIX VERIFICATION: Should redirect again because role changed
    expect(mockNavigate).toHaveBeenCalledWith('/minhas-obras', { replace: true });
  });
});
