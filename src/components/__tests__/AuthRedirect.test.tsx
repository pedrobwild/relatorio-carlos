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

import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUserRole = vi.mocked(useUserRole);

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
    mockedUseUserRole.mockReturnValue({
      role: null,
      loading: true,
      isStaff: false,
      isCustomer: false,
      isAdmin: false,
      isManager: false,
    });

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
    mockedUseUserRole.mockReturnValue({
      role: 'engineer',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: false,
      isManager: false,
    });

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
    mockedUseUserRole.mockReturnValue({
      role: 'customer',
      loading: false,
      isStaff: false,
      isCustomer: true,
      isAdmin: false,
      isManager: false,
    });

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
    mockedUseUserRole.mockReturnValue({
      role: null,
      loading: false,
      isStaff: false,
      isCustomer: false,
      isAdmin: false,
      isManager: false,
    });

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
    mockedUseUserRole.mockReturnValue({
      role: 'admin',
      loading: false,
      isStaff: true,
      isCustomer: false,
      isAdmin: true,
      isManager: false,
    });

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
});
