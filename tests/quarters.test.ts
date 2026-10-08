import { expect, test } from 'vitest';
import { aggregateQuarters } from '../lib/quarters';
import type { Report } from '../lib/koc';
const campus = [{ id: 'a', name: 'Alpha', region: 'North' }, { id: 'b', name: 'Beta', region: 'South' }];
const report = (date: string, attendance: number, campus_id = 'a'): Report => ({ id: date, campus_id, season_id: 's', week_ending: date, attendance, prayer_minutes: 20, evangelism_minutes: 10, outreach_outings: 1, notes: '', submitted_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`, is_late: false });
test('uses calendar quarters across reporting seasons and preserves unreported totals', () => {
  const rows = aggregateQuarters(campus, [report('2026-03-27', 0), report('2026-04-03', 5), { ...report('2026-04-10', 7), season_id: 'another' }], 2026);
  expect(rows).toHaveLength(8);
  expect(rows.find(r => r.campusId === 'a' && r.quarter === 1)).toMatchObject({ reports: 1, attendance: 0 });
  expect(rows.find(r => r.campusId === 'a' && r.quarter === 2)).toMatchObject({ reports: 2, attendance: 12, prayer_minutes: 40 });
  expect(rows.find(r => r.campusId === 'b' && r.quarter === 1)).toMatchObject({ reports: 0, attendance: null, prayer_minutes: null });
});
test('excludes other years and campuses outside the supplied scope', () => {
  const rows = aggregateQuarters(campus.slice(0, 1), [report('2025-12-26', 90), report('2026-01-02', 10, 'b')], 2026);
  expect(rows.every(r => r.reports === 0 && r.attendance === null)).toBe(true);
});
test('excludes inactive campuses even if a directory supplies them',()=>{
 expect(aggregateQuarters([{...campus[0],is_active:false,lifecycle_status:'inactive'}],[report('2026-04-03',99)],2026)).toEqual([]);
});
