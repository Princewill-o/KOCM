import { expect, test } from 'vitest';
import { demoData } from '../lib/demo';

test('creates two consistent sample weeks for every supplied campus', () => {
  const campuses = [{ id: 'a', name: 'Alpha', region: 'North' }, { id: 'b', name: 'Beta', region: 'South' }];
  const season = { id: 'season', name: '2026–27', start_date: '2026-09-18', end_date: '2027-05-28', deadline_hour: 22, time_zone: 'Europe/London' };
  const data = demoData(campuses, season);
  expect(data.reports).toHaveLength(4);
  expect(data.weekly.map(w => w.week_ending)).toEqual(['2026-09-18', '2026-09-25']);
  expect(data.summary.every(c => c.reports === 2)).toBe(true);
  expect(data.weekly.every(w => w.campuses_reported === 2)).toBe(true);
  for (const metric of ['attendance', 'prayer_minutes', 'evangelism_minutes', 'outreach_outings'] as const) {
    expect(data.summary.reduce((n, c) => n + c[metric], 0)).toBe(data.weekly.reduce((n, w) => n + w[metric], 0));
  }
  expect(demoData(campuses, season)).toEqual(data);
  expect(demoData([], season).reports).toEqual([]);
});
