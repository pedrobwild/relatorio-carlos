import { describe, it, expect } from 'vitest';
import { getLeadTimeRisk } from '../purchaseRisk';

describe('getLeadTimeRisk', () => {
  // Reference date: 2025-07-20
  const today = new Date(2025, 6, 20);

  it('returns "unknown" when required_by_date is missing', () => {
    const r = getLeadTimeRisk({}, { lead_time_days: 7 }, today);
    expect(r.level).toBe('unknown');
    expect(r.tone).toBe('muted');
    expect(r.orderByDate).toBeNull();
  });

  it('returns "unknown" when supplier has no lead_time', () => {
    const r = getLeadTimeRisk(
      { required_by_date: '2025-08-01' },
      null,
      today,
    );
    expect(r.level).toBe('unknown');
  });

  it('marks delivered purchases as on_track regardless of dates', () => {
    const r = getLeadTimeRisk(
      { required_by_date: '2025-07-01', status: 'delivered' },
      { lead_time_days: 30 },
      today,
    );
    expect(r.level).toBe('on_track');
    expect(r.message).toBe('Compra concluída');
  });

  it('returns on_track when slack > buffer', () => {
    // arrival ≈ today+5 = 2025-07-25, required = 2025-08-10 → 16 days slack
    const r = getLeadTimeRisk(
      { required_by_date: '2025-08-10' },
      { lead_time_days: 5 },
      today,
    );
    expect(r.level).toBe('on_track');
    expect(r.tone).toBe('success');
    expect(r.slackDays).toBe(16);
  });

  it('returns at_risk when slack is within buffer', () => {
    // arrival = today+5 = 2025-07-25, required = 2025-07-26 → 1 day slack
    const r = getLeadTimeRisk(
      { required_by_date: '2025-07-26' },
      { lead_time_days: 5 },
      today,
    );
    expect(r.level).toBe('at_risk');
    expect(r.tone).toBe('warning');
    expect(r.slackDays).toBe(1);
  });

  it('returns late when arrival is past required_by_date', () => {
    // arrival = today+10 = 2025-07-30, required = 2025-07-25 → -5 days slack
    const r = getLeadTimeRisk(
      { required_by_date: '2025-07-25' },
      { lead_time_days: 10 },
      today,
    );
    expect(r.level).toBe('late');
    expect(r.tone).toBe('danger');
    expect(r.slackDays).toBe(-5);
  });

  it('computes orderByDate as required minus lead_time', () => {
    const r = getLeadTimeRisk(
      { required_by_date: '2025-08-10' },
      { lead_time_days: 7 },
      today,
    );
    // 2025-08-10 - 7d = 2025-08-03
    expect(r.orderByDate?.getFullYear()).toBe(2025);
    expect(r.orderByDate?.getMonth()).toBe(7); // August
    expect(r.orderByDate?.getDate()).toBe(3);
  });

  it('handles zero lead_time as immediate arrival', () => {
    const r = getLeadTimeRisk(
      { required_by_date: '2025-07-25' },
      { lead_time_days: 0 },
      today,
    );
    expect(r.level).toBe('on_track');
    expect(r.slackDays).toBe(5);
  });

  it('returns unknown for negative lead_time', () => {
    const r = getLeadTimeRisk(
      { required_by_date: '2025-07-25' },
      { lead_time_days: -3 },
      today,
    );
    expect(r.level).toBe('unknown');
  });
});
