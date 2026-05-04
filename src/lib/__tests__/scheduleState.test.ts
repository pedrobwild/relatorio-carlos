import { describe, it, expect } from 'vitest';
import { getActivityState } from '../scheduleState';

describe('getActivityState', () => {
  // Reference date: 2025-07-20
  const ref = new Date(2025, 6, 20);

  it('returns "Não iniciada" / neutral when activity has no actuals and start is in the future', () => {
    const r = getActivityState(
      { plannedStart: '2025-08-01', plannedEnd: '2025-08-10' },
      ref,
    );
    expect(r.state).toBe('not_started');
    expect(r.label).toBe('Não iniciada');
    expect(r.tone).toBe('neutral');
    expect(r.delayDays).toBe(0);
  });

  it('returns "Em andamento" / info when started but not finished and within plan', () => {
    const r = getActivityState(
      {
        plannedStart: '2025-07-15',
        plannedEnd: '2025-07-25',
        actualStart: '2025-07-15',
      },
      ref,
    );
    expect(r.state).toBe('in_progress');
    expect(r.label).toBe('Em andamento');
    expect(r.tone).toBe('info');
  });

  it('returns "Concluída" / success when actualEnd is set', () => {
    const r = getActivityState(
      {
        plannedStart: '2025-07-01',
        plannedEnd: '2025-07-10',
        actualStart: '2025-07-01',
        actualEnd: '2025-07-09',
      },
      ref,
    );
    expect(r.state).toBe('completed');
    expect(r.label).toBe('Concluída');
    expect(r.tone).toBe('success');
  });

  it('returns "Atrasada" / danger when started, plannedEnd in past, and not finished', () => {
    const r = getActivityState(
      {
        plannedStart: '2025-07-01',
        plannedEnd: '2025-07-15',
        actualStart: '2025-07-01',
      },
      ref,
    );
    expect(r.state).toBe('delayed');
    expect(r.label).toBe('Atrasada');
    expect(r.tone).toBe('danger');
    expect(r.delayDays).toBe(5);
  });

  it('returns "Atrasada" when not started and plannedStart is in the past', () => {
    const r = getActivityState(
      { plannedStart: '2025-07-10', plannedEnd: '2025-07-20' },
      ref,
    );
    expect(r.state).toBe('delayed');
    expect(r.tone).toBe('danger');
    expect(r.delayDays).toBe(10);
  });

  it('reports delayDays for late completion but keeps state as completed', () => {
    const r = getActivityState(
      {
        plannedStart: '2025-07-01',
        plannedEnd: '2025-07-10',
        actualStart: '2025-07-01',
        actualEnd: '2025-07-15',
      },
      ref,
    );
    expect(r.state).toBe('completed');
    expect(r.delayDays).toBe(5);
  });
});
