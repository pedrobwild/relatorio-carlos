import { describe, it, expect } from 'vitest';
import { getEtapaWeek, formatEtapaLabel } from '../painelEtapaWeek';

const exec = (start: string | null, inicio_oficial: string | null = null) => ({
  etapa: 'Execução' as const,
  inicio_etapa: start,
  inicio_oficial,
});

describe('getEtapaWeek', () => {
  it('retorna null para etapas que não são Execução', () => {
    expect(getEtapaWeek({ etapa: 'Planejamento', inicio_etapa: '2026-04-01', inicio_oficial: null })).toBeNull();
    expect(getEtapaWeek({ etapa: 'Finalizada', inicio_etapa: '2026-04-01', inicio_oficial: null })).toBeNull();
    expect(getEtapaWeek({ etapa: null, inicio_etapa: '2026-04-01', inicio_oficial: null })).toBeNull();
  });

  it('retorna null quando não há data de início (etapa nem oficial)', () => {
    expect(getEtapaWeek(exec(null, null))).toBeNull();
  });

  it('retorna null para data inválida', () => {
    expect(getEtapaWeek(exec('not-a-date'))).toBeNull();
  });

  it('usa inicio_oficial como fallback quando inicio_etapa é null', () => {
    const now = new Date(2026, 3, 8); // 8/abr/2026
    expect(getEtapaWeek(exec(null, '2026-04-01'), now)).toBe(2);
  });

  it('S1 nos primeiros 7 dias (dias 0..6)', () => {
    const start = '2026-04-01';
    for (let d = 0; d <= 6; d++) {
      const now = new Date(2026, 3, 1 + d);
      expect(getEtapaWeek(exec(start), now)).toBe(1);
    }
  });

  it('avança a semana a cada 7 dias', () => {
    const start = '2026-04-01';
    const cases: Array<[Date, number]> = [
      [new Date(2026, 3, 1), 1],   // dia 0
      [new Date(2026, 3, 7), 1],   // dia 6
      [new Date(2026, 3, 8), 2],   // dia 7  → S2
      [new Date(2026, 3, 14), 2],  // dia 13
      [new Date(2026, 3, 15), 3],  // dia 14 → S3
      [new Date(2026, 3, 21), 3],  // dia 20
      [new Date(2026, 3, 22), 4],  // dia 21 → S4
      [new Date(2026, 3, 29), 5],  // dia 28 → S5 (cenário do enunciado)
      [new Date(2026, 5, 3), 10],  // dia 63 → S10
    ];
    for (const [now, expected] of cases) {
      expect(getEtapaWeek(exec(start), now)).toBe(expected);
    }
  });

  it('clampa em S1 quando a data atual é anterior ao início', () => {
    const now = new Date(2026, 2, 25); // 25/mar/2026
    expect(getEtapaWeek(exec('2026-04-01'), now)).toBe(1);
  });

  it('ignora horário do dia (compara apenas a data civil)', () => {
    const start = '2026-04-01';
    const earlyMorning = new Date(2026, 3, 8, 0, 5, 0); // 00:05
    const lateNight = new Date(2026, 3, 8, 23, 55, 0);  // 23:55
    expect(getEtapaWeek(exec(start), earlyMorning)).toBe(2);
    expect(getEtapaWeek(exec(start), lateNight)).toBe(2);
  });
});

describe('formatEtapaLabel', () => {
  it('devolve null quando obra não tem etapa', () => {
    expect(formatEtapaLabel({ etapa: null, inicio_etapa: null, inicio_oficial: null })).toBeNull();
  });

  it('devolve o nome puro para etapas que não são Execução', () => {
    expect(
      formatEtapaLabel({ etapa: 'Planejamento', inicio_etapa: '2026-04-01', inicio_oficial: null }),
    ).toBe('Planejamento');
    expect(
      formatEtapaLabel({ etapa: 'Finalizada', inicio_etapa: null, inicio_oficial: null }),
    ).toBe('Finalizada');
  });

  it('devolve "Execução" puro quando faltam datas', () => {
    expect(formatEtapaLabel(exec(null, null))).toBe('Execução');
  });

  it('formata "Execução - S{N}" conforme a semana', () => {
    const start = '2026-04-01';
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 1))).toBe('Execução - S1');
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 8))).toBe('Execução - S2');
    expect(formatEtapaLabel(exec(start), new Date(2026, 3, 29))).toBe('Execução - S5');
  });
});
