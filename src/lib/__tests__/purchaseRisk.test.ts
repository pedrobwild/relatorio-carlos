import { describe, it, expect } from 'vitest';
import { getLeadTimeRisk } from '../purchaseRisk';

const REF = new Date(2026, 3, 26); // Apr 26, 2026

describe('getLeadTimeRisk', () => {
  it('returns on_track when terminal status (delivered)', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-04-01',
        lead_time_days: 30,
        status: 'delivered',
      },
      null,
      REF,
    );
    expect(info.level).toBe('on_track');
    expect(info.tone).toBe('success');
  });

  it('returns unknown when required_by_date missing', () => {
    const info = getLeadTimeRisk({ lead_time_days: 7 }, null, REF);
    expect(info.level).toBe('unknown');
    expect(info.tone).toBe('muted');
  });

  it('returns unknown when no lead-time anywhere', () => {
    const info = getLeadTimeRisk(
      { required_by_date: '2026-05-30' },
      null,
      REF,
    );
    expect(info.level).toBe('unknown');
  });

  it('prefers supplier lead_time over purchase lead_time', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-05-10', // 14 days from REF
        lead_time_days: 5,
      },
      { lead_time_days: 30 }, // supplier wins → would be late
      REF,
    );
    expect(info.level).toBe('late');
  });

  it('flags late when today + lead_time > required_by_date', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-04-30', // 4 days slack
        lead_time_days: 10,
      },
      null,
      REF,
    );
    expect(info.level).toBe('late');
    expect(info.tone).toBe('danger');
    expect(info.daysOfSlack).toBeLessThan(0);
  });

  it('flags tight when 0-2 days of slack', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-05-04', // 8 days from REF
        lead_time_days: 7, // order by Apr 27 = 1 day slack
      },
      null,
      REF,
    );
    expect(info.level).toBe('tight');
    expect(info.tone).toBe('warning');
    expect(info.daysOfSlack).toBe(1);
  });

  it('flags on_track when comfortable slack', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-06-01',
        lead_time_days: 7,
      },
      null,
      REF,
    );
    expect(info.level).toBe('on_track');
    expect(info.tone).toBe('success');
    expect(info.daysOfSlack).toBeGreaterThan(2);
  });

  it('falls back to purchase lead_time when no supplier', () => {
    const info = getLeadTimeRisk(
      {
        required_by_date: '2026-06-01',
        lead_time_days: 5,
      },
      undefined,
      REF,
    );
    expect(info.level).toBe('on_track');
    expect(info.orderByDate).not.toBeNull();
  });
});
