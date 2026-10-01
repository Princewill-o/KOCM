import { describe, it, expect } from 'vitest';
import { buildWeeks, deadlineFor, openingFor, hours, deadlineLabel, type Season } from '../lib/reporting';

const season: Season = { id: '2026-2027', name: '2026–2027', start_date: '2026-09-18', end_date: '2027-05-28', deadline_hour: 22, time_zone: 'Europe/London' };

describe('Friday reporting deadlines', () => {
  it('uses UK summer time in September and GMT in winter', () => {
    expect(deadlineFor('2026-09-18', season).toISOString()).toBe('2026-09-18T21:00:00.000Z');
    expect(deadlineFor('2026-10-30', season).toISOString()).toBe('2026-10-30T22:00:00.000Z');
    expect(deadlineFor('2027-04-02', season).toISOString()).toBe('2027-04-02T21:00:00.000Z');
  });
  it('opens each week at midnight on the Saturday before', () => {
    expect(openingFor('2026-10-02', season).toISOString()).toBe('2026-09-25T23:00:00.000Z');
    expect(openingFor('2026-11-06', season).toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });
  it('marks unreported expired weeks missing and keeps future weeks upcoming', () => {
    const weeks = buildWeeks(season, [], new Date('2026-09-26T12:00:00Z'));
    expect(weeks.find((w) => w.weekEnding === '2026-09-18')?.status).toBe('missing');
    expect(weeks.find((w) => w.weekEnding === '2026-10-02')?.status).toBe('due');
    expect(weeks.find((w) => w.weekEnding === '2026-10-09')?.status).toBe('upcoming');
    expect(weeks).toHaveLength(37);
  });
  it('keeps submitted and late reports distinct', () => {
    const weeks = buildWeeks(season, [{ week_ending: '2026-09-18', is_late: false }, { week_ending: '2026-09-25', is_late: true }], new Date('2026-09-26'));
    expect(weeks[0].status).toBe('submitted');
    expect(weeks[1].status).toBe('late');
  });
  it('formats durations and deadlines', () => {
    expect(hours(90)).toBe('1h 30m');
    expect(hours(5)).toBe('0h 05m');
    expect(deadlineLabel(22)).toBe('10:00pm');
    expect(deadlineLabel(12)).toBe('12:00pm');
  });
});
