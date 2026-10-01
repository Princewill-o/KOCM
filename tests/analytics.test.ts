import { expect, test } from 'vitest';
import { completionRows, createWorkbook } from '../lib/analytics';
const season = { id: 's', name: '2026–27', start_date: '2026-09-18', end_date: '2027-05-28', deadline_hour: 22, time_zone: 'Europe/London' };
const weekly = [{ week_ending: '2026-09-18', campuses_reported: 1, attendance: 20, prayer_minutes: 90, evangelism_minutes: 60, outreach_outings: 2 }];
test('counts overdue and still-due reports separately and excludes future weeks', () => {
  const rows = completionRows(season, 3, weekly, new Date('2026-09-24T12:00:00Z'));
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ completed: 1, overdue: 2, pending: 0 });
  expect(rows[1]).toMatchObject({ completed: 0, overdue: 0, pending: 3 });
  expect(completionRows(season, 3, [], new Date('2026-09-01'))).toEqual([]);
});
test('exports a readable workbook with numeric totals, completion and demo labels', async () => {
  const book = await createWorkbook([], weekly, completionRows(season, 3, weekly, new Date('2026-09-24')), season, true);
  const bytes = await book.xlsx.writeBuffer();
  const { Workbook } = await import('exceljs');
  const loaded = new Workbook();
  await loaded.xlsx.load(bytes);
  expect(loaded.worksheets.map(s => s.name)).toEqual(['About', 'Campus totals', 'Weekly statistics', 'Report completion', 'Campus weekly records']);
  expect(loaded.getWorksheet('About')?.getCell('B2').value).toContain('FICTIONAL');
  expect(loaded.getWorksheet('Weekly statistics')?.getCell('C2').value).toBe(20);
  expect(loaded.getWorksheet('Report completion')?.getCell('D2').value).toBe(2);
});

test('includes zero activity, missing campus weeks and notes without treating missing reports as zero', async () => {
  const summary = [{ campus_id: 'a', campus_name: 'Alpha', region: 'North', reports: 1, late_reports: 0, attendance: 0, prayer_minutes: 0, evangelism_minutes: 0, outreach_outings: 0, last_week: '2026-09-18' }];
  const report = { id: 'r', campus_id: 'a', season_id: 's', week_ending: '2026-09-18', attendance: 0, prayer_minutes: 0, evangelism_minutes: 0, outreach_outings: 0, notes: '=Not a formula', submitted_at: '2026-09-18T18:00:00Z', updated_at: '2026-09-18T18:00:00Z', is_late: false };
  const completion = completionRows(season, 1, [], new Date('2026-09-24'));
  const book = await createWorkbook(summary, [], completion, season, false, [report]);
  const sheet = book.getWorksheet('Campus weekly records')!;
  expect(sheet.rowCount).toBe(3);
  expect(sheet.getCell('D2').value).toBe('Submitted');
  expect(sheet.getCell('E2').value).toBe(0);
  expect(sheet.getCell('D3').value).toBe('Pending');
  expect(sheet.getCell('E3').value).toBeNull();
  expect(sheet.getCell('K2').value).toBe('=Not a formula');
  expect(book.getWorksheet('Weekly statistics')?.rowCount).toBe(3);
});
