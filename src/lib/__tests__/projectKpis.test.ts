import { describe, it, expect } from 'vitest';
import {
  computeCostKPIs,
  computeDaysOverdue,
  computeStageKPIs,
  deriveDisplayStatus,
  normalizeProgress,
} from '../projectKpis';

const NOW = new Date('2026-04-24T12:00:00-03:00');

describe('deriveDisplayStatus', () => {
  it('marca Atrasado quando entrega oficial vencida sem entrega real', () => {
    expect(
      deriveDisplayStatus({
        status: 'Em dia',
        entregaOficial: '2026-04-20',
        entregaReal: null,
        now: NOW,
      }),
    ).toBe('Atrasado');
  });

  it('mantém status quando já há entrega real', () => {
    expect(
      deriveDisplayStatus({
        status: 'Em dia',
        entregaOficial: '2026-04-20',
        entregaReal: '2026-04-22',
        now: NOW,
      }),
    ).toBe('Em dia');
  });

  it('mantém status quando entrega oficial ainda no futuro', () => {
    expect(
      deriveDisplayStatus({
        status: 'Em dia',
        entregaOficial: '2026-05-20',
        entregaReal: null,
        now: NOW,
      }),
    ).toBe('Em dia');
  });

  it('preserva null quando não há status salvo nem prazo', () => {
    expect(
      deriveDisplayStatus({
        status: null,
        entregaOficial: null,
        entregaReal: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('não isenta atraso mesmo para status Paralisada se entrega oficial venceu', () => {
    expect(
      deriveDisplayStatus({
        status: 'Paralisada',
        entregaOficial: '2026-04-10',
        entregaReal: null,
        now: NOW,
      }),
    ).toBe('Atrasado');
  });
});

describe('computeDaysOverdue', () => {
  it('retorna 0 quando já existe entrega real', () => {
    expect(
      computeDaysOverdue({
        entregaOficial: '2026-04-01',
        entregaReal: '2026-04-03',
        now: NOW,
      }),
    ).toBe(0);
  });

  it('retorna diferença positiva quando prazo venceu', () => {
    expect(
      computeDaysOverdue({
        entregaOficial: '2026-04-20',
        entregaReal: null,
        now: NOW,
      }),
    ).toBe(4);
  });

  it('retorna 0 quando ainda no prazo', () => {
    expect(
      computeDaysOverdue({
        entregaOficial: '2026-05-10',
        entregaReal: null,
        now: NOW,
      }),
    ).toBe(0);
  });

  it('retorna 0 quando prazo ausente', () => {
    expect(
      computeDaysOverdue({
        entregaOficial: null,
        entregaReal: null,
        now: NOW,
      }),
    ).toBe(0);
  });
});

describe('computeCostKPIs', () => {
  it('soma apenas parcelas pagas', () => {
    const result = computeCostKPIs({
      contractValue: 100_000,
      payments: [
        { amount: 30_000, paid_at: '2026-01-10' },
        { amount: 20_000, paid_at: null }, // pendente
        { amount: 10_000, paid_at: '2026-02-10' },
      ],
    });
    expect(result.planned).toBe(100_000);
    expect(result.paid).toBe(40_000);
    expect(result.remaining).toBe(60_000);
    expect(result.percentPaid).toBe(40);
  });

  it('lida com contrato ausente', () => {
    const result = computeCostKPIs({
      contractValue: null,
      payments: [{ amount: 5_000, paid_at: '2026-01-10' }],
    });
    expect(result.planned).toBeNull();
    expect(result.paid).toBe(5_000);
    expect(result.remaining).toBeNull();
    expect(result.percentPaid).toBe(0);
  });

  it('clampa percentPaid em 100', () => {
    const result = computeCostKPIs({
      contractValue: 10_000,
      payments: [{ amount: 15_000, paid_at: '2026-01-10' }],
    });
    expect(result.percentPaid).toBe(100);
    expect(result.remaining).toBe(0);
  });
});

describe('computeStageKPIs', () => {
  it('aponta próxima etapa na ordem canônica', () => {
    const kpi = computeStageKPIs('Executivo');
    expect(kpi.current).toBe('Executivo');
    expect(kpi.next).toBe('Emissão RRT');
    expect(kpi.currentIndex).toBe(1);
    expect(kpi.totalStages).toBe(10);
  });

  it('retorna próxima nula em Finalizada', () => {
    const kpi = computeStageKPIs('Finalizada');
    expect(kpi.current).toBe('Finalizada');
    expect(kpi.next).toBeNull();
  });

  it('Vistoria reprovada aponta direto para Finalizada', () => {
    const kpi = computeStageKPIs('Vistoria reprovada');
    expect(kpi.next).toBe('Finalizada');
  });

  it('sem etapa preenchida sugere Medição', () => {
    const kpi = computeStageKPIs(null);
    expect(kpi.current).toBeNull();
    expect(kpi.next).toBe('Medição');
  });
});

describe('normalizeProgress', () => {
  it('arredonda e clampa em [0,100]', () => {
    expect(normalizeProgress(57.4)).toBe(57);
    expect(normalizeProgress(101)).toBe(100);
    expect(normalizeProgress(-5)).toBe(0);
  });

  it('retorna null quando ausente', () => {
    expect(normalizeProgress(null)).toBeNull();
    expect(normalizeProgress(undefined)).toBeNull();
  });
});
