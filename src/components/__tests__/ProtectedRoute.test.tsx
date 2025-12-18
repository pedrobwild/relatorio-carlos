import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute, StaffRoute, CustomerRoute } from '@/components/ProtectedRoute';

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUserRole = vi.mocked(useUserRole);

const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner when auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: null,
      loading: true,
      isStaff: false,
      isCustomer: false,
      isAdmin: false,
    });

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should redirect to /auth when not authenticated', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
      session: null,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: null,
      loading: false,
      isStaff: false,
      isCustomer: false,
      isAdmin: false,
    });

    const { queryByTestId } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'customer',
      loading: false,
      isStaff: false,
      isCustomer: true,
      isAdmin: false,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should redirect customer to /minhas-obras when accessing staff routes', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'customer',
      loading: false,
      isStaff: false,
      isCustomer: true,
      isAdmin: false,
    });

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['engineer', 'admin']}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should redirect staff to /gestao when accessing customer routes', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'engineer',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: false,
    });

    const { queryByTestId } = render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['customer']}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});

describe('StaffRoute', () => {
  it('should allow engineers access', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'engineer',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: false,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>
    );

    expect(getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should allow admins access', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'admin',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: true,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <StaffRoute>
          <TestComponent />
        </StaffRoute>
      </MemoryRouter>
    );

    expect(getByTestId('protected-content')).toBeInTheDocument();
  });
});

describe('CustomerRoute', () => {
  it('should allow customers access', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'customer',
      loading: false,
      isStaff: false,
      isCustomer: true,
      isAdmin: false,
    });

    const { getByTestId } = render(
      <MemoryRouter>
        <CustomerRoute>
          <TestComponent />
        </CustomerRoute>
      </MemoryRouter>
    );

    expect(getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should deny staff access', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: vi.fn(),
    });
    mockedUseUserRole.mockReturnValue({
      role: 'engineer',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: false,
    });

    const { queryByTestId } = render(
      <MemoryRouter>
        <CustomerRoute>
          <TestComponent />
        </CustomerRoute>
      </MemoryRouter>
    );

    expect(queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
