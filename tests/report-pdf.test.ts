import { expect, test } from 'vitest';
import { buildReportPdf, reportPdfFilename } from '../lib/report-pdf';
import type { Report } from '../lib/koc';
const report: Report = { id: 'record-1', campus_id: 'campus-1', season_id: 'season-1', week_ending: '2026-10-02', attendance: 0, prayer_minutes: 125, evangelism_minutes: 55, outreach_outings: 2, notes: 'First paragraph.\nSecond paragraph with an important final detail.', submitted_at: '2026-10-02T21:15:00Z', updated_at: '2026-10-03T10:30:00Z', is_late: true };
const context = { campus: { id: 'campus-1', name: 'Example University', region: 'North', cluster_id: 'cluster-1' }, season: { id: 'season-1', name: '2026/27', start_date: '2026-09-18', end_date: '2027-05-28', deadline_hour: 22, time_zone: 'Europe/London' } };
function pdfText(doc: Awaited<ReturnType<typeof buildReportPdf>>) { return doc.output(); }
test('creates an actual PDF preserving identifiers, timing, zero statistics and full notes', async () => {
  const doc = await buildReportPdf(report, context);
  const output = pdfText(doc);
  expect(output.startsWith('%PDF-')).toBe(true);
  for (const text of ['record-1', 'campus-1', 'cluster-1', 'Example University', 'North', '2026/27', 'Late', report.submitted_at, report.updated_at, '125', '55', 'Second paragraph with an important final detail.']) expect(output).toContain(text);
  expect(output).toContain('Not recorded');
  expect(output).toContain('Attendance occasions: 0');
  expect(output).toContain('02 Oct 2026, 22:15'); // British summer time, not UTC
});
test('paginates long notes without losing the last paragraph and numbers every page', async () => {
  const notes = Array.from({ length: 220 }, (_, i) => `Paragraph ${i}: Detailed campus reporting notes for the permanent record.`).join('\n');
  const doc = await buildReportPdf({ ...report, notes }, context);
  expect(doc.getNumberOfPages()).toBeGreaterThan(3);
  const output = pdfText(doc);
  expect(output).toContain('Paragraph 219:');
  expect(output).toContain(`Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`);
});
test('rejects mismatched campus or season rather than exporting mislabelled records', async () => {
  await expect(buildReportPdf({ ...report, campus_id: 'another' }, context)).rejects.toThrow('does not match');
  await expect(buildReportPdf({ ...report, season_id: 'another' }, context)).rejects.toThrow('does not match');
});
test('filenames are safe and identify the campus and week', () => {
  expect(reportPdfFilename('Example / University', report)).toBe('kocm-example-university-2026-10-02.pdf');
});
