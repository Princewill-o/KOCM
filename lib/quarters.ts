import type { Campus, Report } from './koc';
export type QuarterMetric = 'attendance' | 'prayer_minutes' | 'evangelism_minutes' | 'outreach_outings';
export type QuarterRow = { campusId: string; campusName: string; region: string; year: number; quarter: number; reports: number } & Record<QuarterMetric, number | null>;
export const quarterMetrics: Record<QuarterMetric, string> = { attendance: 'Attendance', prayer_minutes: 'Prayer minutes', evangelism_minutes: 'Evangelism minutes', outreach_outings: 'Outreach outings' };
/** Missing reports remain unknown rather than being presented as zero activity. */
export function aggregateQuarters(campuses: Campus[], reports: Report[], year: number): QuarterRow[] {
  return campuses.filter(c=>c.is_active !== false && (!c.lifecycle_status || c.lifecycle_status === 'active')).flatMap(campus => [1, 2, 3, 4].map(quarter => {
    const matched = reports.filter(r => r.campus_id === campus.id && Number(r.week_ending.slice(0, 4)) === year && Math.ceil(Number(r.week_ending.slice(5, 7)) / 3) === quarter);
    const sum = (key: QuarterMetric) => matched.length ? matched.reduce((total, r) => total + r[key], 0) : null;
    return { campusId: campus.id, campusName: campus.name, region: campus.region, year, quarter, reports: matched.length, attendance: sum('attendance'), prayer_minutes: sum('prayer_minutes'), evangelism_minutes: sum('evangelism_minutes'), outreach_outings: sum('outreach_outings') };
  }));
}
