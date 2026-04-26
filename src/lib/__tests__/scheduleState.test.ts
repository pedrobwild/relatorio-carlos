import { describe, it, expect } from 'vitest';
import { getActivityState, getWeightTotalInfo } from '../scheduleState';

const REF = new Date(2026, 3, 26); // Apr 26, 2026 (matches today's date in env)

describe('getActivityState', () => {
  it('returns completed when actual_end is set', () => {
    const info = getActivityState(
      {
        planned_start: '2026-04-01',
        planned_end: '2026-04-15',
        actual_start: '2026-04-01',
        actual_end: '2026-04-14',
      },
      REF,
    );
    expect(info.state).toBe('completed');
    expect(info.tone).toBe('success');
    expect(info.label).toBe('Concluída');
  });

  it('returns in_progress when started and within plan', () => {
    const info = getActivityState(
      {
        planned_start: '2026-04-20',
        planned_end: '2026-04-30',
        actual_start: '2026-04-22',
        actual_end: null,
      },
      REF,
    );
    expect(info.state).toBe('in_progress');
    expect(info.tone).toBe('info');
  });

  it('returns delayed when started but past planned_end', () => {
    const info = getActivityState(
      {
        planned_start: '2026-04-01',
        planned_end: '2026-04-20',
        actual_start: '2026-04-01',
        actual_end: null,
      },
      REF,
    );
    expect(info.state).toBe('delayed');
    expect(info.tone).toBe('danger');
  });

  it('returns delayed when not started but past planned_start', () => {
    const info = getActivityState(
      {
        planned_start: '2026-04-10',
        planned_end: '2026-04-30',
        actual_start: null,
        actual_end: null,
      },
      REF,
    );
    expect(info.state).toBe('delayed');
  });

  it('returns not_started when fully in the future', () => {
    const info = getActivityState(
      {
        planned_start: '2026-05-01',
        planned_end: '2026-05-15',
        actual_start: null,
        actual_end: null,
      },
      REF,
    );
    expect(info.state).toBe('not_started');
    expect(info.tone).toBe('neutral');
  });
});

describe('getWeightTotalInfo', () => {
  it('flags exact 100% as ok', () => {
    const info = getWeightTotalInfo([25, 25, 25, 25]);
    expect(info.state).toBe('ok');
    expect(info.tone).toBe('success');
    expect(info.total).toBe(100);
  });

  it('absorbs float rounding within 0.5', () => {
    const info = getWeightTotalInfo([33.33, 33.33, 33.34]);
    expect(info.state).toBe('ok');
  });

  it('flags 95-99% as close (warning)', () => {
    const info = getWeightTotalInfo([30, 30, 38]);
    expect(info.state).toBe('close');
    expect(info.tone).toBe('warning');
  });

  it('flags 101-105% as close (warning)', () => {
    const info = getWeightTotalInfo([35, 35, 33]);
    expect(info.state).toBe('close');
  });

  it('flags below 95% as off (danger)', () => {
    const info = getWeightTotalInfo([20, 20, 20]);
    expect(info.state).toBe('off');
    expect(info.tone).toBe('danger');
    expect(info.message).toContain('falta');
  });

  it('flags above 105% as off (danger)', () => {
    const info = getWeightTotalInfo([50, 50, 50]);
    expect(info.state).toBe('off');
    expect(info.message).toContain('excede');
  });

  it('handles empty list as off', () => {
    const info = getWeightTotalInfo([]);
    expect(info.state).toBe('off');
    expect(info.total).toBe(0);
  });
});
