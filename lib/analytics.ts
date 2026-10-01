import type { CampusSummary, WeeklyTotal, Report } from './koc';
import { buildWeeks, type Season } from './reporting';

export function completionRows(season: Season, campusCount: number, weekly: WeeklyTotal[], now = new Date()) {
  return buildWeeks(season, [], now).filter(w => w.status !== 'upcoming').map(w => {
    const completed = Math.min(campusCount, weekly.find(r => r.week_ending === w.weekEnding)?.campuses_reported ?? 0);
    const remaining = campusCount - completed;
    return { week: w.weekEnding, expected: campusCount, completed, overdue: w.status === 'missing' ? remaining : 0, pending: w.status === 'due' ? remaining : 0 };
  });
}

export async function createWorkbook(summary: CampusSummary[], weekly: WeeklyTotal[], completion: ReturnType<typeof completionRows>, season: Season, demo: boolean, reports: Report[] = []) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  book.creator = 'Kharis On Campus Management';
  const add = (name: string, headers: string[], rows: (string | number | null)[][]) => {
    const sheet = book.addWorksheet(name);
    sheet.addRow(headers);
    sheet.addRows(rows);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF171717' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9D62B' } };
    });
    sheet.columns.forEach((column, i) => { column.width = i === 0 ? 32 : 23; });
    sheet.getRow(1).height = 32;
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    return sheet;
  };
  const about = add('About', ['Field', 'Value'], [
    ['Data source', demo ? 'DEMO — FICTIONAL SAMPLE DATA' : 'Live reporting data'], ['Season', season.name],
    ['Season starts', season.start_date], ['Season ends', season.end_date], ['Exported at (UTC)', new Date().toISOString()],
    ['Completion scope', 'All opened weeks; future weeks excluded.'],
    ['Not yet done', 'Overdue plus pending before Friday deadline.'],
    ['Campus scope', 'Current active campuses; one report expected each week.'],
    ['Units', 'Attendance counts visits; prayer and evangelism are minutes.'],
    ['Zero and blank values', '0 means recorded zero activity. Blank activity cells mean no report submitted.'],
    ['Weekly totals', 'Totals of submitted reports only; reporting coverage is shown alongside them.'],
  ]);
  about.getColumn(2).width = 75;
  const scopedReports = reports.filter(r => r.season_id === season.id && summary.some(c => c.campus_id === r.campus_id));
  const index = new Map(scopedReports.map(r => [`${r.campus_id}/${r.week_ending}`, r]));
  add('Campus totals', ['Campus', 'Region', 'Reports completed', 'Late reports', 'Attendance', 'Prayer minutes', 'Evangelism minutes', 'Outreach outings', 'Latest report', 'Reports expected', 'Overdue', 'Pending', 'Not yet done'], summary.map(r => {
    const missing = completion.filter(w => !index.has(`${r.campus_id}/${w.week}`));
    const overdue = missing.filter(w => w.pending === 0).length;
    const pending = missing.length - overdue;
    return [r.campus_name, r.region, r.reports, r.late_reports, r.attendance, r.prayer_minutes, r.evangelism_minutes, r.outreach_outings, r.last_week, completion.length, overdue, pending, missing.length];
  }));
  const dates = [...new Set([...completion.map(w => w.week), ...weekly.map(w => w.week_ending)])].sort();
  add('Weekly statistics', ['Week ending', 'Campuses reported', 'Attendance', 'Prayer minutes', 'Evangelism minutes', 'Outreach outings', 'Expected reports', 'Not yet done', 'Coverage'], dates.map(date => {
    const w = weekly.find(w => w.week_ending === date);
    const c = completion.find(w => w.week === date);
    return [date, w?.campuses_reported ?? 0, w?.attendance ?? 0, w?.prayer_minutes ?? 0, w?.evangelism_minutes ?? 0, w?.outreach_outings ?? 0, c?.expected ?? 0, c ? c.overdue + c.pending : 0, w?.campuses_reported ? 'Submitted reports only' : 'No reports submitted'];
  }));
  add('Report completion', ['Week ending', 'Expected', 'Completed', 'Overdue', 'Pending before deadline', 'Not yet done'], completion.map(r => [r.week, r.expected, r.completed, r.overdue, r.pending, r.overdue + r.pending]));
  const detail = add('Campus weekly records', ['Campus', 'Region', 'Week ending', 'Status', 'Attendance', 'Prayer minutes', 'Evangelism minutes', 'Outreach outings', 'Submitted at (UTC)', 'Updated at (UTC)', 'Notes'], summary.flatMap(campus => completion.map(w => {
    const r = index.get(`${campus.campus_id}/${w.week}`);
    return [campus.campus_name, campus.region, w.week, r ? r.is_late ? 'Late' : 'Submitted' : w.pending > 0 ? 'Pending' : 'Overdue', r?.attendance ?? null, r?.prayer_minutes ?? null, r?.evangelism_minutes ?? null, r?.outreach_outings ?? null, r?.submitted_at ?? null, r?.updated_at ?? null, r?.notes ?? ''];
  })));
  detail.getColumn(11).width = 50;
  detail.getColumn(11).alignment = { wrapText: true, vertical: 'top' };
  return book;
}

export async function downloadWorkbook(summary: CampusSummary[], weekly: WeeklyTotal[], completion: ReturnType<typeof completionRows>, season: Season, demo: boolean, reports: Report[] = []) {
  const book = await createWorkbook(summary, weekly, completion, season, demo, reports);
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `KOC-${demo ? 'DEMO-' : ''}${season.start_date}-statistics.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
