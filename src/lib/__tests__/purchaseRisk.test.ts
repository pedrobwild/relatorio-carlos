import { describe, it, expect } from 'vitest';
import { getLeadTimeRisk } from '../purchaseRisk';

const REF = new Date(2025, 6, 20); // 2025-07-20

const base = {
  lead_time_days: 5,
  required_by_date: '2025-08-10',
  status: 'pending' as const,
};

describe('getLeadTimeRisk', () => {
  it('returns "safe" when there is plenty of slack', () => {
    const info = getLeadTimeRisk(base, undefined, REF);
    expect(info.risk).toBe('safe');
    expect(info.tone).toBe('success');
    expect(info.slackDays).toBeGreaterThan(3);
    expect(info.shortLabel).toBe('No prazo');
  });

  it('returns "approaching" warning when slack is 3 days or less', () => {
    const info = getLeadTimeRisk(
      { ...base, required_by_date: '2025-07-27' }, // 7 days away, lead 5 → 2 days slack
      undefined,
      REF,
    );
    expect(info.risk).toBe('approaching');
    expect(info.tone).toBe('warning');
  });

  it('returns "critical" danger when lead time exceeds remaining days', () => {
    const info = getLeadTimeRisk(
      { ...base, required_by_date: '2025-07-22', lead_time_days: 10 },
      undefined,
      REF,
    );
    expect(info.risk).toBe('critical');
    expect(info.tone).toBe('danger');
    expect(info.slackDays).toBeLessThan(0);
  });

  it('returns "overdue" when required_by_date is in the past', () => {
    const info = getLeadTimeRisk(
      { ...base, required_by_date: '2025-07-10' },
      undefined,
      REF,
    );
    expect(info.risk).toBe('overdue');
    expect(info.tone).toBe('danger');
    expect(info.daysUntilRequired).toBeLessThan(0);
  });

  it('returns "closed" muted for delivered purchases', () => {
    const info = getLeadTimeRisk({ ...base, status: 'delivered' }, undefined, REF);
    expect(info.risk).toBe('closed');
    expect(info.tone).toBe('muted');
  });

  it('returns "closed" for cancelled purchases', () => {
    const info = getLeadTimeRisk({ ...base, status: 'cancelled' }, undefined, REF);
    expect(info.risk).toBe('closed');
  });

  it("uses supplier's lead_time_days when provided", () => {
    // Required: 2025-07-27 (7 days away). Purchase lead = 2 (safe). Supplier lead = 10 (critical).
    const info = getLeadTimeRisk(
      { ...base, required_by_date: '2025-07-27', lead_time_days: 2 },
      { lead_time_days: 10 },
      REF,
    );
    expect(info.risk).toBe('critical');
  });

  it('falls back to purchase lead_time_days when supplier is null or has no lead time', () => {
    const info = getLeadTimeRisk(
      { ...base, required_by_date: '2025-07-22', lead_time_days: 10 },
      { lead_time_days: null },
      REF,
    );
    // purchase lead = 10, required in 2 days → critical
    expect(info.risk).toBe('critical');
  });

  it('treats negative lead times as 0 (defensive)', () => {
    const info = getLeadTimeRisk(
      { ...base, lead_time_days: -5 },
      undefined,
      REF,
    );
    // 21 days away, lead clamped to 0 → safe
    expect(info.risk).toBe('safe');
    expect(info.slackDays).toBe(info.daysUntilRequired);
  });
});
