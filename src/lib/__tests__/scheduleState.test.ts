import { describe, it, expect } from 'vitest';
import { getActivityState } from '../scheduleState';

const REF = new Date(2025, 6, 20); // 2025-07-20 local

describe('getActivityState', () => {
  it('returns "not_started" for activity that has not started and is not late', () => {
    const info = getActivityState(
      { plannedStart: '2025-07-25', plannedEnd: '2025-07-30' },
      REF,
    );
    expect(info.state).toBe('not_started');
    expect(info.label).toBe('Não iniciada');
    expect(info.tone).toBe('neutral');
  });

  it('returns "in_progress" while running before the planned end', () => {
    const info = getActivityState(
      {
        plannedStart: '2025-07-15',
        plannedEnd: '2025-07-25',
        actualStart: '2025-07-15',
      },
      REF,
    );
    expect(info.state).toBe('in_progress');
    expect(info.tone).toBe('info');
  });

  it('returns "completed" when actualEnd is set, regardless of planned end', () => {
    const info = getActivityState(
      {
        plannedStart: '2025-07-01',
        plannedEnd: '2025-07-10',
        actualStart: '2025-07-01',
        actualEnd: '2025-07-15',
      },
      REF,
    );
    expect(info.state).toBe('completed');
    expect(info.label).toBe('Concluída');
    expect(info.tone).toBe('success');
  });

  it('returns "delayed" when activity should have started but did not', () => {
    const info = getActivityState(
      { plannedStart: '2025-07-10', plannedEnd: '2025-07-15' },
      REF,
    );
    expect(info.state).toBe('delayed');
    expect(info.tone).toBe('danger');
    expect(info.isAutoDelayed).toBe(true);
    expect(info.delayDays).toBeGreaterThan(0);
  });

  it('returns "delayed" when activity is in progress past the planned end', () => {
    const info = getActivityState(
      {
        plannedStart: '2025-07-01',
        plannedEnd: '2025-07-10',
        actualStart: '2025-07-01',
      },
      REF,
    );
    expect(info.state).toBe('delayed');
    expect(info.isAutoDelayed).toBe(true);
  });
});
