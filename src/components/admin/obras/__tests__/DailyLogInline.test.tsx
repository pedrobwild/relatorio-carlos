/**
 * DailyLogInline — testes de componente
 *
 * Cobertura:
 *  1. A seção unificada "Serviços e prestadores" renderiza ambas as
 *     subseções (Serviços em execução + Prestadores no local) num único
 *     colapsável.
 *  2. Quando aberta, o cabeçalho mostra o contador agregado (services +
 *     workers) como Badge no header do SectionCard.
 *  3. Quando fechada, o `previewWhenClosed` exibe os totais corretos
 *     ("N serviços • M prestadores"), com pluralização.
 *  4. Estado vazio mostra a microcopy de "Nenhum serviço ou prestador".
 *
 * As dependências externas (hooks de fetch/save e ServiceTasksList) são
 * mockadas para isolar a renderização da DailyLogInline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDailyLog } from '@/hooks/useProjectDailyLog';

// ---- Mocks de dependências ----------------------------------------------

const mockUseProjectDailyLog = vi.fn();
const mockUseSaveProjectDailyLog = vi.fn(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

vi.mock('@/hooks/useProjectDailyLog', async () => {
  const actual =
    await vi.importActual<typeof import('@/hooks/useProjectDailyLog')>(
      '@/hooks/useProjectDailyLog',
    );
  return {
    ...actual,
    useProjectDailyLog: (...args: unknown[]) => mockUseProjectDailyLog(...args),
    useSaveProjectDailyLog: (...args: unknown[]) =>
      mockUseSaveProjectDailyLog(...args),
  };
});

// Mock leve para ServiceTasksList — não é foco deste teste e depende de
// outro hook (useDailyLogServiceTasks) que não vale puxar aqui.
vi.mock('@/components/admin/obras/ServiceTasksList', () => ({
  ServiceTasksList: () => <div data-testid="service-tasks-list" />,
}));

// useToast é usado pelo handleSave; basta um stub que não quebre.
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ---- Fixtures -----------------------------------------------------------

function makeLog(
  partial: Partial<ProjectDailyLog> = {},
): ProjectDailyLog {
  return {
    id: 'log-1',
    project_id: 'proj-1',
    log_date: '2026-04-27',
    notes: null,
    services: [],
    workers: [],
    ...partial,
  } as ProjectDailyLog;
}

const baseProps = { projectId: 'proj-1', initialDate: '2026-04-27' };

// ---- Importação tardia (após os mocks) ----------------------------------
// Importamos o componente APÓS o vi.mock para garantir que ele use os
// mocks definidos acima.
let DailyLogInline: typeof import('../DailyLogInline').DailyLogInline;
beforeEach(async () => {
  vi.clearAllMocks();
  // Limpa preferências persistidas entre testes para que o defaultOpen
  // calculado pelo componente prevaleça.
  window.localStorage.clear();
  ({ DailyLogInline } = await import('../DailyLogInline'));
});

// ---- Testes -------------------------------------------------------------

describe('DailyLogInline — seção unificada Serviços e prestadores', () => {
  it('renderiza as duas subseções (Serviços + Prestadores) dentro de um único card', () => {
    mockUseProjectDailyLog.mockReturnValue({
      data: makeLog({
        services: [
          {
            id: 's1',
            description: 'Instalação elétrica',
            status: 'Em andamento',
            observations: null,
            start_date: null,
            end_date: null,
            position: 0,
          },
        ],
        workers: [
          {
            id: 'w1',
            name: 'João da Silva',
            role: 'Eletricista',
            period_start: null,
            period_end: null,
            shift_start: null,
            shift_end: null,
            notes: null,
            position: 0,
          },
        ],
      }),
      isLoading: false,
    });

    render(<DailyLogInline {...baseProps} />);

    // O título do card unificado deve aparecer uma única vez.
    expect(
      screen.getByRole('button', { name: /Recolher Serviços e prestadores/i }),
    ).toBeInTheDocument();

    // As duas subseções devem estar acessíveis pelos seus headings.
    expect(
      screen.getByRole('heading', { name: /Serviços em execução/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Prestadores no local/i }),
    ).toBeInTheDocument();

    // Conteúdo das duas listas presente lado a lado.
    expect(screen.getByDisplayValue('Instalação elétrica')).toBeInTheDocument();
    expect(screen.getByDisplayValue('João da Silva')).toBeInTheDocument();
  });

  it('exibe o contador agregado (services + workers) no header quando aberto', () => {
    mockUseProjectDailyLog.mockReturnValue({
      data: makeLog({
        services: [
          { id: 's1', description: 'A', status: 'Em andamento', observations: null, start_date: null, end_date: null, position: 0 },
          { id: 's2', description: 'B', status: 'Em andamento', observations: null, start_date: null, end_date: null, position: 1 },
        ],
        workers: [
          { id: 'w1', name: 'X', role: null, period_start: null, period_end: null, shift_start: null, shift_end: null, notes: null, position: 0 },
        ],
      }),
      isLoading: false,
    });

    render(<DailyLogInline {...baseProps} />);

    const header = screen.getByRole('button', {
      name: /Recolher Serviços e prestadores/i,
    });
    // Badge agregada: 2 serviços + 1 prestador = 3
    expect(within(header).getByText('3')).toBeInTheDocument();

    // Contadores por subseção (badges nos SubsectionHeader).
    const servicesHeading = screen.getByRole('heading', {
      name: /Serviços em execução/i,
    });
    expect(
      within(servicesHeading.parentElement as HTMLElement).getByText('2'),
    ).toBeInTheDocument();

    const workersHeading = screen.getByRole('heading', {
      name: /Prestadores no local/i,
    });
    expect(
      within(workersHeading.parentElement as HTMLElement).getByText('1'),
    ).toBeInTheDocument();
  });

  it('mostra preview com contadores corretos (pluralizados) quando o card está fechado', async () => {
    const user = userEvent.setup();
    mockUseProjectDailyLog.mockReturnValue({
      data: makeLog({
        services: [
          { id: 's1', description: 'A', status: 'Em andamento', observations: null, start_date: null, end_date: null, position: 0 },
        ],
        workers: [
          { id: 'w1', name: 'X', role: null, period_start: null, period_end: null, shift_start: null, shift_end: null, notes: null, position: 0 },
          { id: 'w2', name: 'Y', role: null, period_start: null, period_end: null, shift_start: null, shift_end: null, notes: null, position: 1 },
        ],
      }),
      isLoading: false,
    });

    render(<DailyLogInline {...baseProps} />);

    // Fecha o colapsável clicando no header.
    const trigger = screen.getByRole('button', {
      name: /Recolher Serviços e prestadores/i,
    });
    await user.click(trigger);

    // Após colapsar, o preview com totais aparece. Pluralização:
    //   1 -> "serviço" (singular), 2 -> "prestadores" (plural).
    expect(
      screen.getByText('1 serviço • 2 prestadores'),
    ).toBeInTheDocument();
  });

  it('mostra microcopy de estado vazio quando não há serviços nem prestadores', async () => {
    const user = userEvent.setup();
    mockUseProjectDailyLog.mockReturnValue({
      data: makeLog({ services: [], workers: [] }),
      isLoading: false,
    });

    render(<DailyLogInline {...baseProps} />);

    // Quando sem conteúdo, o defaultOpen é false; preview deve aparecer
    // sem precisar clicar.
    expect(
      screen.getByText(/Nenhum serviço ou prestador — toque para adicionar/i),
    ).toBeInTheDocument();

    // Ao expandir, vemos os EmptyLines individuais de cada subseção.
    const trigger = screen.getByRole('button', {
      name: /Expandir Serviços e prestadores/i,
    });
    await user.click(trigger);

    expect(
      screen.getByText(/Nenhum serviço adicionado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum prestador adicionado/i),
    ).toBeInTheDocument();
  });
});
