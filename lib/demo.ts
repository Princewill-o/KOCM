import type { Campus, CampusSummary, Report, WeeklyTotal } from './koc';
import { buildWeeks, type Season } from './reporting';

/** Synthetic preview only: never persisted or passed to reporting mutations. */
export function demoData(campuses: Campus[], season: Season) {
  const weeks = buildWeeks(season, []).slice(0, 2);
  const reports: Report[] = campuses.flatMap((campus, i) => weeks.map((week, w) => ({
    id: `demo-${campus.id}-${w}`, campus_id: campus.id, season_id: season.id,
    week_ending: week.weekEnding,
    attendance: 12 + (i * 13 % 55) + w * (i % 5 === 0 ? -3 : 4 + i % 9),
    prayer_minutes: 60 + (i * 3 % 15) * 30 + w * 30,
    evangelism_minutes: 45 + (i * 7 % 10) * 30 + w * 15,
    outreach_outings: 1 + i % 4 + w * (i % 3 === 0 ? 0 : 1),
    notes: 'Fictional sample for dashboard preview.',
    submitted_at: `${week.weekEnding}T18:00:00Z`, updated_at: `${week.weekEnding}T18:00:00Z`, is_late: false,
  })));
  const sum = (rows: Report[]) => rows.reduce((a, r) => ({
    attendance: a.attendance + r.attendance, prayer_minutes: a.prayer_minutes + r.prayer_minutes,
    evangelism_minutes: a.evangelism_minutes + r.evangelism_minutes, outreach_outings: a.outreach_outings + r.outreach_outings,
  }), { attendance: 0, prayer_minutes: 0, evangelism_minutes: 0, outreach_outings: 0 });
  const summary: CampusSummary[] = campuses.map(c => ({
    campus_id: c.id, campus_name: c.name, region: c.region, reports: weeks.length, late_reports: 0,
    last_week: weeks.at(-1)?.weekEnding ?? null, ...sum(reports.filter(r => r.campus_id === c.id)),
  }));
  const weekly: WeeklyTotal[] = weeks.map(w => ({
    week_ending: w.weekEnding, campuses_reported: campuses.length, ...sum(reports.filter(r => r.week_ending === w.weekEnding)),
  }));
  return { reports, summary, weekly };
}
