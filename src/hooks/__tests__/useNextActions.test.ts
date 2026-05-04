import { describe, expect, it } from 'vitest';
import { rankNextActions, type NextAction } from '../useNextActions';
import type { PendingItem } from '../usePendencias';
import type { UpcomingPayment } from '../useClientDashboard';

const baseDate = new Date('2026-05-04T12:00:00Z');
const isoOffset = (days: number) => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const pending = (overrides: Partial<PendingItem> = {}): PendingItem => ({
  id: 'p1',
  type: 'approval_exec',
  title: 'Aprovar Projeto Executivo',
  description: '',
  dueDate: isoOffset(2),
  createdDate: baseDate.toISOString(),
  priority: 'média',
  status: 'pending',
  ...overrides,
});

const payment = (overrides: Partial<UpcomingPayment> = {}): UpcomingPayment => ({
  id: 'pay1',
  project_id: 'proj-1',
  project_name: 'Casa Teste',
  description: 'Parcela 3',
  amount: 5000,
  due_date: isoOffset(3),
  installment_number: 3,
  ...overrides,
});

describe('rankNextActions', () => {
  it('returns empty array when no inputs are provided', () => {
    const result = rankNextActions({
      pendingItems: [],
      upcomingPayments: [],
      tacitFormalizations: [],
      now: baseDate,
    });
    expect(result).toEqual([]);
  });

  it('promotes overdue items to critical urgency and ranks them first', () => {
    const result = rankNextActions({
      pendingItems: [
        pending({ id: 'late', dueDate: isoOffset(-2), title: 'Decisão atrasada' }),
        pending({ id: 'soon', dueDate: isoOffset(2), title: 'Decisão amanhã' }),
      ],
      upcomingPayments: [],
      tacitFormalizations: [],
      now: baseDate,
    });

    expect(result.length).toBe(2);
    expect(result[0].urgency).toBe('critical');
    expect(result[0].type).toBe('overdue');
    expect(result[0].title).toBe('Decisão atrasada');
    expect(result[1].urgency).toBe('high');
  });

  it('caps the list to 3 items even when more would qualify', () => {
    const items: PendingItem[] = Array.from({ length: 5 }, (_, idx) =>
      pending({ id: `p${idx}`, dueDate: isoOffset(idx), title: `Item ${idx}` }),
    );
    const result = rankNextActions({
      pendingItems: items,
      upcomingPayments: [],
      tacitFormalizations: [],
      now: baseDate,
    });
    expect(result.length).toBe(3);
  });

  it('surfaces tacit formalizations when deadline is within 3 days', () => {
    const result: NextAction[] = rankNextActions({
      pendingItems: [],
      upcomingPayments: [],
      tacitFormalizations: [
        {
          id: 'tac1',
          title: 'Projeto Executivo v2',
          project_id: 'proj-9',
          deadline_iso: isoOffset(1),
        },
      ],
      now: baseDate,
    });
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('tacit');
    expect(result[0].owner).toBe('client');
    expect(result[0].cta.href).toBe('/obra/proj-9/formalizacoes/tac1');
    expect(result[0].impact.toLowerCase()).toContain('automaticamente');
  });

  it('ignores tacit formalizations whose deadline is far in the future', () => {
    const result = rankNextActions({
      pendingItems: [],
      upcomingPayments: [],
      tacitFormalizations: [
        {
          id: 'tac-late',
          title: 'Anexo A',
          project_id: 'proj-1',
          deadline_iso: isoOffset(15),
        },
      ],
      now: baseDate,
    });
    expect(result).toEqual([]);
  });

  it('mixes payment urgency with pending items and ranks by urgency', () => {
    const result = rankNextActions({
      pendingItems: [
        pending({ id: 'mid', dueDate: isoOffset(4), title: 'Decisão futura' }),
      ],
      upcomingPayments: [payment({ id: 'pay-overdue', due_date: isoOffset(-1) })],
      tacitFormalizations: [],
      now: baseDate,
    });
    expect(result[0].id).toBe('payment:pay-overdue');
    expect(result[0].urgency).toBe('critical');
    expect(result[0].type).toBe('overdue');
  });

  it('skips pending items without due date so they do not crowd the cockpit', () => {
    const result = rankNextActions({
      pendingItems: [pending({ id: 'no-date', dueDate: '' })],
      upcomingPayments: [],
      tacitFormalizations: [],
      now: baseDate,
    });
    expect(result).toEqual([]);
  });
});
