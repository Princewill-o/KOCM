import type { Campus, Report } from './koc';
import type { Season } from './reporting';

type RecordReport = Report & { submitted_by?: string; submitted_by_name?: string; updated_by?: string };
type Context = { campus: Campus; season: Season; fontBase64?: string };

export function reportPdfFilename(campusName: string, report: Report): string {
  const name = campusName.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'campus';
  return `kocm-${name}-${report.week_ending}.pdf`;
}

/** Export only a record already returned by the user's authorised report query. */
export async function buildReportPdf(report: RecordReport, { campus, season, fontBase64 }: Context) {
  if (report.campus_id !== campus.id || report.season_id !== season.id) throw new Error('The report does not match the selected campus and season.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  let font = 'helvetica';
  if (fontBase64) {
    doc.addFileToVFS('ReportSans.ttf', fontBase64);
    doc.addFont('ReportSans.ttf', 'ReportSans', 'normal');
    font = 'ReportSans';
  }
  doc.setFont(font, 'normal');
  doc.setProperties({ title: `${campus.name} - weekly report ${report.week_ending}`, subject: 'KOCM submitted weekly report record', creator: 'KOCM' });
  const left = 18, width = 174, bottom = 277;
  let y = 22;
  function header(continued = false) {
    doc.setFontSize(17); doc.setTextColor(32, 35, 31);
    doc.text(continued ? 'Weekly report - continued' : 'KOCM weekly report', left, 18);
    doc.setDrawColor(222, 223, 216); doc.line(left, 23, 192, 23);
    y = 31;
  }
  function line(value: string, size = 10) {
    doc.setFontSize(size);
    const wrapped: string[] = doc.splitTextToSize(value || ' ', width);
    const height = size * 0.3528 * 1.45;
    for (const text of wrapped) {
      if (y + height > bottom) { doc.addPage(); header(true); doc.setFontSize(size); }
      doc.text(text, left, y); y += height;
    }
    y += 1.5;
  }
  function timestamp(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value || 'Not recorded';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: season.time_zone, hourCycle: 'h23' }).format(date);
  }
  header();
  line(`Campus: ${campus.name}`, 12);
  line(`Campus ID: ${campus.id}`);
  line(`Cluster / region: ${campus.region || 'Unassigned'}`);
  line(`Cluster ID: ${campus.cluster_id || 'Unassigned'}`);
  line(`Season: ${season.name} (${season.start_date} to ${season.end_date})`);
  line(`Season ID: ${season.id}`);
  line(`Week ending: ${report.week_ending}`);
  line(`Report ID: ${report.id}`);
  line(`Submission: ${report.is_late ? 'Late' : 'On time'}`);
  line(`First submitted: ${timestamp(report.submitted_at)} (${season.time_zone})`);
  line(`Submitted timestamp: ${report.submitted_at}`);
  line(`Last updated: ${timestamp(report.updated_at)} (${season.time_zone})`);
  line(`Updated timestamp: ${report.updated_at}`);
  line(`Submitted by: ${report.submitted_by_name || report.submitted_by || 'Not recorded'}`);
  if (report.submitted_by_name && report.submitted_by) line(`Submitter ID: ${report.submitted_by}`);
  if (report.updated_by) line(`Last updated by: ${report.updated_by}`);
  y += 3;
  line('Submitted statistics', 12);
  line(`Attendance occasions: ${report.attendance}`);
  line(`Prayer: ${report.prayer_minutes} minutes`);
  line(`Evangelism: ${report.evangelism_minutes} minutes`);
  line(`Outreach outings: ${report.outreach_outings}`);
  y += 3;
  line('Notes', 12);
  for (const paragraph of (report.notes || 'No notes submitted.').split(/\r?\n/)) line(paragraph);
  y += 3;
  line('Attendance counts visits, not unique people. This record reflects the latest saved report at download time.', 9);
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(104, 113, 104);
    doc.text(`KOCM | ${report.week_ending} | Page ${page} of ${count}`, left, 288);
  }
  return doc;
}

export async function downloadReportPdf(report: RecordReport, context: Omit<Context, 'fontBase64'>) {
  const response = await fetch('/fonts/report-sans.ttf', { cache: 'force-cache' });
  if (!response.ok) throw new Error('Could not load the PDF font. Please try again.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  const doc = await buildReportPdf(report, { ...context, fontBase64: btoa(binary) });
  doc.save(reportPdfFilename(context.campus.name, report));
}
