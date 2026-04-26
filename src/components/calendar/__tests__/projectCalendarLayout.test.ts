import { describe, it, expect } from 'vitest';
import {
  buildMonthWeeks,
  eventsOnDay,
  parseLocal,
  type ProjectCalendarEvent,
} from '../projectCalendarLayout';

describe('buildMonthWeeks', () => {
  it('returns weeks starting on Monday', () => {
    // 2025-07-15 (terça) → primeiro dia visível deve ser segunda 2025-06-30
    const weeks = buildMonthWeeks(new Date(2025, 6, 15));
    expect(weeks.length).toBeGreaterThanOrEqual(5);
    expect(weeks[0][0].getDay()).toBe(1); // Monday
    weeks.forEach((week) => expect(week).toHaveLength(7));
  });
});

describe('eventsOnDay', () => {
  const events: ProjectCalendarEvent<{ name: string }>[] = [
    { id: 'a', start: '2025-07-10', end: '2025-07-15', entity: { name: 'A' } },
    { id: 'b', start: '2025-07-12', end: '2025-07-12', entity: { name: 'B' } },
    { id: 'c', start: '2025-07-20', end: '2025-07-25', entity: { name: 'C' } },
  ];

  it('returns events that span the given day', () => {
    const result = eventsOnDay(events, new Date(2025, 6, 12));
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('returns events on the boundary days (start/end inclusive)', () => {
    expect(eventsOnDay(events, new Date(2025, 6, 10)).map((e) => e.id)).toEqual(['a']);
    expect(eventsOnDay(events, new Date(2025, 6, 15)).map((e) => e.id)).toEqual(['a']);
  });

  it('returns empty array when no events touch the day', () => {
    expect(eventsOnDay(events, new Date(2025, 6, 17))).toEqual([]);
  });
});

describe('parseLocal', () => {
  it('parses YYYY-MM-DD as local midnight (no timezone shift)', () => {
    const d = parseLocal('2025-07-15');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
  });
});
