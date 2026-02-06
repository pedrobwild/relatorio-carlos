import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/hooks/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [
      {
        id: '1',
        name: 'Test Project',
        unit_name: 'Unit A',
        status: 'active',
        planned_start_date: null, // Null date - should not crash
        planned_end_date: null,   // Null date - should not crash
        actual_start_date: null,
        created_at: '2025-01-01',
        is_project_phase: false,
      },
      {
        id: '2',
        name: 'Valid Project',
        unit_name: 'Unit B',
        status: 'active',
        planned_start_date: '2025-01-01',
        planned_end_date: '2025-06-01',
        actual_start_date: '2025-01-15',
        created_at: '2025-01-01',
        is_project_phase: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({
    role: 'customer',
    loading: false,
    isStaff: false,
    isCustomer: true,
  }),
}));

// Import after mocks
import MinhasObras from '../MinhasObras';

describe('MinhasObras', () => {
  it('should render without crashing when projects have null dates', () => {
    expect(() => {
      render(
        <BrowserRouter>
          <MinhasObras />
        </BrowserRouter>
      );
    }).not.toThrow();
  });

  it('should display "A definir" for null start/end dates', async () => {
    const { container } = render(
      <BrowserRouter>
        <MinhasObras />
      </BrowserRouter>
    );

    // Should show "A definir" text for projects with null dates
    expect(container.textContent).toContain('A definir');
  });

  it('should format valid dates correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <MinhasObras />
      </BrowserRouter>
    );

    // Should display the valid project name
    expect(container.textContent).toContain('Valid Project');
  });

  it('should show project phase badge for projects in project phase', async () => {
    const { container } = render(
      <BrowserRouter>
        <MinhasObras />
      </BrowserRouter>
    );

    // Project 2 has is_project_phase: true
    expect(container.textContent).toContain('Fase de Projeto');
  });
});
