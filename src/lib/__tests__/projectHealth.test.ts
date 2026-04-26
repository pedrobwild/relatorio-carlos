import { describe, it, expect } from 'vitest';
import {
  getProjectStaleInfo,
  getProjectDelayInfo,
  STALE_PROJECT_DAYS,
  APPROACHING_DEADLINE_DAYS,
  type HealthProject,
  type HealthSummary,
} from '@/lib/projectHealth';

const NOW = new Date('2025-04-23T12:00:00.000Z');

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('getProjectStaleInfo', () => {
  it('returns isStale=false for non-active projects regardless of last activity', () => {
    const project: HealthProject = {
      status: 'paused',
      created_at: isoDaysAgo(60),
    };
    const summary: HealthSummary = { last_activity_at: isoDaysAgo(60) };
    expect(getProjectStaleInfo(project, summary, NOW).isStale).toBe(false);
  });

  it('uses summary.last_activity_at when provided (preferred over created_at)', () => {
    const project: HealthProject = {
      status: 'active',
      created_at: isoDaysAgo(60),
    };
    const summary: HealthSummary = { last_activity_at: isoDaysAgo(2) };
    const info = getProjectStaleInfo(project, summary, NOW);
    expect(info.isStale).toBe(false);
    expect(info.days).toBe(2);
    expect(info.refDate).toBe(summary.last_activity_at);
  });

  it('falls back to created_at when summary has no last activity', () => {
    const project: HealthProject = {
      status: 'active',
      created_at: isoDaysAgo(10),
    };
    const info = getProjectStaleInfo(project, null, NOW);
    expect(info.isStale).toBe(true);
    expect(info.days).toBe(10);
  });

  it(`flips to stale at exactly ${STALE_PROJECT_DAYS} full days`, () => {
    const project: HealthProject = {
      status: 'active',
      created_at: isoDaysAgo(STALE_PROJECT_DAYS - 1),
    };
    expect(getProjectStaleInfo(project, null, NOW).isStale).toBe(false);

    const projectAtThreshold: HealthProject = {
      status: 'active',
      created_at: isoDaysAgo(STALE_PROJECT_DAYS),
    };
    expect(getProjectStaleInfo(projectAtThreshold, null, NOW).isStale).toBe(true);
  });

  it('returns days=null when there is no reference date at all', () => {
    const project: HealthProject = { status: 'active', created_at: null };
    expect(getProjectStaleInfo(project, null, NOW)).toEqual({
      isStale: false,
      days: null,
      refDate: null,
    });
  });
});

describe('getProjectDelayInfo', () => {
  it('returns null for non-active projects', () => {
    expect(
      getProjectDelayInfo(
        { status: 'completed', planned_end_date: '2025-01-01' },
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when project already finished (actual_end_date set)', () => {
    expect(
      getProjectDelayInfo(
        {
          status: 'active',
          planned_end_date: '2025-04-30',
          actual_end_date: '2025-04-20',
        },
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when there is no planned end date', () => {
    expect(
      getProjectDelayInfo({ status: 'active', planned_end_date: null }, NOW),
    ).toBeNull();
  });

  it('flags overdue projects with positive daysOverdue', () => {
    const info = getProjectDelayInfo(
      { status: 'active', planned_end_date: '2025-04-20' },
      NOW,
    );
    expect(info).not.toBeNull();
    expect(info!.isOverdue).toBe(true);
    expect(info!.daysOverdue).toBe(3);
    expect(info!.daysRemaining).toBe(-3);
    expect(info!.isApproaching).toBe(false);
  });

  it('flags projects within the approaching window', () => {
    const info = getProjectDelayInfo(
      { status: 'active', planned_end_date: '2025-05-05' },
      NOW,
    );
    expect(info!.isOverdue).toBe(false);
    expect(info!.isApproaching).toBe(true);
    expect(info!.daysRemaining).toBe(12);
  });

  it(`drops out of "approaching" past the ${APPROACHING_DEADLINE_DAYS}-day window`, () => {
    const info = getProjectDelayInfo(
      { status: 'active', planned_end_date: '2025-06-30' },
      NOW,
    );
    expect(info!.isApproaching).toBe(false);
    expect(info!.isOverdue).toBe(false);
  });
});
