import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingChecklist } from '../OnboardingChecklist';
import { onboardingFlows } from '@/content/onboardingFlows';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

const mockUserRole = vi.fn();
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => mockUserRole(),
}));

vi.mock('@/lib/telemetry', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/errorLogger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const chain = () => {
    const obj: any = {};
    obj.select = vi.fn(() => obj);
    obj.eq = vi.fn(() => obj);
    obj.is = vi.fn(() => obj);
    obj.upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    obj.then = (resolve: any) => resolve({ data: [], error: null });
    return obj;
  };
  return {
    supabase: {
      from: vi.fn(() => chain()),
    },
  };
});

function renderChecklist(props: Parameters<typeof OnboardingChecklist>[0]) {
  return render(
    <MemoryRouter>
      <OnboardingChecklist {...props} />
    </MemoryRouter>,
  );
}

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUserRole.mockReset();
    mockUserRole.mockReturnValue({
      roles: ['customer'],
      isStaff: false,
      isCustomer: true,
      isAdmin: false,
      isManager: false,
      loading: false,
    });
  });

  it('renderiza fluxo cliente:execucao quando role=cliente e status=execucao', async () => {
    renderChecklist({ userRole: 'cliente', obraStatus: 'execucao' });
    const expected = onboardingFlows['cliente:execucao'];
    await waitFor(() => {
      expect(screen.getByText(expected[0].title)).toBeInTheDocument();
    });
    expect(screen.getByText(expected[1].title)).toBeInTheDocument();
  });

  it('renderiza fluxo equipe:planejamento quando role=equipe e status=planejamento', async () => {
    renderChecklist({ userRole: 'equipe', obraStatus: 'planejamento' });
    const expected = onboardingFlows['equipe:planejamento'];
    await waitFor(() => {
      expect(screen.getByText(expected[0].title)).toBeInTheDocument();
    });
  });

  it('renderiza fluxo admin:entrega quando role=admin e status=entrega', async () => {
    renderChecklist({ userRole: 'admin', obraStatus: 'entrega' });
    const expected = onboardingFlows['admin:entrega'];
    await waitFor(() => {
      expect(screen.getByText(expected[0].title)).toBeInTheDocument();
    });
  });

  it('infere papel a partir de useUserRole quando userRole não é passado', async () => {
    mockUserRole.mockReturnValue({
      roles: ['admin'],
      isStaff: true,
      isCustomer: false,
      isAdmin: true,
      isManager: false,
      loading: false,
    });
    renderChecklist({ obraStatus: 'execucao' });
    const expected = onboardingFlows['admin:execucao'];
    await waitFor(() => {
      expect(screen.getByText(expected[0].title)).toBeInTheDocument();
    });
  });

  it('expõe progresso "X de Y concluídos" no cabeçalho', async () => {
    renderChecklist({ userRole: 'equipe', obraStatus: 'execucao' });
    const total = onboardingFlows['equipe:execucao'].length;
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`0 de ${total} concluídos`))).toBeInTheDocument();
    });
  });

  it('expõe data-flow-key indicando combinação papel:fase', async () => {
    const { container } = renderChecklist({
      userRole: 'cliente',
      obraStatus: 'planejamento',
    });
    await waitFor(() => {
      const node = container.querySelector('[data-testid="onboarding-checklist"]');
      expect(node?.getAttribute('data-flow-key')).toBe('cliente:planejamento');
    });
  });
});
