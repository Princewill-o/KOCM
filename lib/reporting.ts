// Pure reporting-calendar helpers shared by the UI and tests.
// The database (public.submit_report) enforces the same rules on every save.

export type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  deadline_hour: number;
  time_zone: string;
};

export type WeekStatus = 'upcoming' | 'due' | 'missing' | 'submitted' | 'late';
export type Week = { weekEnding: string; deadlineAt: string; status: WeekStatus };

/** Hour (0-23) that a UTC instant shows on the wall clock in `timeZone`. */
function localHour(instant: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(instant));
}

/** Wall-clock `hour`:00 on `date` in `timeZone`, as a real instant (handles BST/GMT). */
export function localTime(date: string, hour: number, timeZone: string) {
  const nominal = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  if (Number.isNaN(nominal.valueOf())) throw new Error('Invalid date');
  let shift = localHour(nominal, timeZone) - hour;
  if (shift > 12) shift -= 24;
  if (shift < -12) shift += 24;
  return new Date(nominal.valueOf() - shift * 3600000);
}

export function deadlineFor(weekEnding: string, season: Pick<Season, 'deadline_hour' | 'time_zone'>) {
  return localTime(weekEnding, season.deadline_hour, season.time_zone);
}

/** A reporting week opens at 00:00 on the Saturday before its Friday. */
export function openingFor(weekEnding: string, season: Pick<Season, 'time_zone'>) {
  const d = new Date(`${weekEnding}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return localTime(d.toISOString().slice(0, 10), 0, season.time_zone);
}

export function buildWeeks(season: Season, reports: { week_ending: string; is_late: boolean }[], now = new Date()): Week[] {
  const result: Week[] = [];
  for (let d = new Date(`${season.start_date}T12:00:00Z`); d.toISOString().slice(0, 10) <= season.end_date; d.setUTCDate(d.getUTCDate() + 7)) {
    const weekEnding = d.toISOString().slice(0, 10);
    const deadlineAt = deadlineFor(weekEnding, season);
    const report = reports.find((r) => r.week_ending === weekEnding);
    const status: WeekStatus = report
      ? report.is_late ? 'late' : 'submitted'
      : openingFor(weekEnding, season) > now ? 'upcoming' : now >= deadlineAt ? 'missing' : 'due';
    result.push({ weekEnding, deadlineAt: deadlineAt.toISOString(), status });
  }
  return result;
}

export const hours = (minutes: number) => `${Math.floor(minutes / 60).toLocaleString('en-GB')}h ${String(minutes % 60).padStart(2, '0')}m`;
export const formatDate = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const shortDate = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const deadlineLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}:00${hour >= 12 ? 'pm' : 'am'}`;
