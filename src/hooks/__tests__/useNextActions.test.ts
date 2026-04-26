import { describe, it, expect } from 'vitest';
import { buildNextActions } from '../useNextActions';
import type { PendingItem } from '../usePendencias';

const NOW = new Date('2026-04-26T12:00:00Z');

const daysFromNow = (days: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const makePendencia = (overrides: Partial<PendingItem> = {}): PendingItem => ({
  id: overrides.id ?? `p${Math.random()}`,
  type: 'decision',
  title: 'Pendência genérica',
  description: '',
  dueDate: daysFromNow(10),
  createdDate: '2026-04-01T00:00:00Z',
  priority: 'baixa',
  status: 'pending',
  ...overrides,
});

const PATH_FOR = (kind: string, projectId?: string) =>
  projectId ? `/obra/${projectId}/${kind}` : `/${kind}`;

describe('buildNextActions', () => {
  it('returns empty list when nothing is pending and no payments are due', () => {
    const actions = buildNextActions({
      pendencias: [],
      payments: [],
      pathFor: PATH_FOR,
      now: NOW,
    });
    expect(actions).toEqual([]);
  });

  it('returns up to 3 ranked items, with overdue first', () => {
    const actions = buildNextActions({
      pendencias: [
        makePendencia({ id: 'overdue', dueDate: daysFromNow(-3), title: 'Atrasada' }),
        makePendencia({
          id: 'tacit',
          type: 'approval_exec',
          dueDate: daysFromNow(2),
          title: 'Tácita iminente',
        }),
        makePendencia({
          id: 'approval',
          type: 'signature',
          dueDate: daysFromNow(4),
          title: 'Assinatura próxima',
        }),
        makePendencia({
          id: 'extra',
          type: 'signature',
          dueDate: daysFromNow(5),
          title: 'Assinatura extra',
        }),
      ],
      payments: [
        {
          id: 'pay1',
          description: 'Parcela 1',
          amount: 1000,
          due_date: daysFromNow(3),
          project_id: 'proj-1',
          project_name: 'Obra Demo',
        },
      ],
      pathFor: PATH_FOR,
      now: NOW,
    });

    expect(actions).toHaveLength(3);
    expect(actions[0].type).toBe('overdue');
    expect(actions[0].id).toBe('pendencia:overdue');
    expect(actions[1].type).toBe('tacit');
    // 3rd slot goes to a non-overdue item ranked by type then urgency.
    expect(['payment', 'approval']).toContain(actions[2].type);
  });

  it('escalates an executive approval inside the tacit window to type=tacit/critical', () => {
    const actions = buildNextActions({
      pendencias: [
        makePendencia({
          id: 'tacit-1',
          type: 'approval_exec',
          dueDate: daysFromNow(1),
          title: 'Aprovar Executivo',
        }),
      ],
      payments: [],
      pathFor: PATH_FOR,
      now: NOW,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('tacit');
    expect(actions[0].urgency).toBe('critical');
    expect(actions[0].cta.label).toMatch(/Aprovar/);
    expect(actions[0].impact).toMatch(/1 dia\(s\)/);
  });

  it('marks payment as overdue when due_date is in the past', () => {
    const actions = buildNextActions({
      pendencias: [],
      payments: [
        {
          id: 'pay-overdue',
          description: 'Parcela 2',
          amount: 500,
          due_date: daysFromNow(-2),
          project_id: 'proj-1',
          project_name: 'Obra X',
        },
      ],
      pathFor: PATH_FOR,
      now: NOW,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('overdue');
    expect(actions[0].id).toBe('payment-overdue:pay-overdue');
    expect(actions[0].title).toMatch(/venceu/);
  });

  it('ignores payments outside the urgent window (>7 days)', () => {
    const actions = buildNextActions({
      pendencias: [],
      payments: [
        {
          id: 'pay-far',
          description: 'Parcela 5',
          amount: 100,
          due_date: daysFromNow(30),
          project_id: 'proj-1',
        },
      ],
      pathFor: PATH_FOR,
      now: NOW,
    });
    expect(actions).toEqual([]);
  });

  it('skips items with missing or invalid due dates without throwing', () => {
    const actions = buildNextActions({
      pendencias: [
        makePendencia({ id: 'no-date', dueDate: '' }),
        makePendencia({ id: 'bad-date', dueDate: 'not-a-date' }),
      ],
      payments: [
        { id: 'pay-no-date', description: 'X', amount: 0, due_date: null, project_id: 'p' },
      ],
      pathFor: PATH_FOR,
      now: NOW,
    });
    expect(actions).toEqual([]);
  });
});
