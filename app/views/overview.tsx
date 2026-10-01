'use client';
import { useEffect, useMemo, useState } from 'react';
import { Users, Clock3, Megaphone, Footprints, CalendarClock, ArrowRight, Search } from 'lucide-react';
import { campusSummary, weeklyTotals, friendly, type Profile, type CampusSummary, type WeeklyTotal } from '@/lib/koc';
import { buildWeeks, deadlineLabel, formatDate, hours, shortDate, type Season } from '@/lib/reporting';
import type { Jump } from '../dashboard';

type Metric = 'attendance' | 'prayer_minutes' | 'evangelism_minutes' | 'outreach_outings';
const metricLabels: Record<Metric, string> = { attendance: 'Attendance', prayer_minutes: 'Prayer minutes', evangelism_minutes: 'Evangelism minutes', outreach_outings: 'Outreach outings' };
type SortKey = 'campus_name' | 'region' | Metric | 'reports';

export default function Overview({ season, profile, jump }: { season: Season; profile: Profile; jump: Jump }) {
  const [summary, setSummary] = useState<CampusSummary[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyTotal[]>([]);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<Metric>('attendance');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'campus_name', dir: 1 });

  useEffect(() => {
    Promise.all([campusSummary(season.id), weeklyTotals(season.id)])
      .then(([s, w]) => { setSummary(s); setWeekly(w); })
      .catch((e) => setError(friendly(e)));
  }, [season.id]);

  // The most recent week whose deadline has passed or is due now.
  const currentWeek = useMemo(() => {
    const weeks = buildWeeks(season, []);
    return [...weeks].reverse().find((w) => w.status === 'due') ?? [...weeks].reverse().find((w) => w.status === 'missing') ?? null;
  }, [season]);

  if (error) return <div className="management-alert" role="alert">{error}</div>;
  if (!summary) return <p role="status" className="loading-line">Loading all campus statistics…</p>;

  const totals = summary.reduce((a, r) => ({
    attendance: a.attendance + r.attendance, prayer_minutes: a.prayer_minutes + r.prayer_minutes,
    evangelism_minutes: a.evangelism_minutes + r.evangelism_minutes, outreach_outings: a.outreach_outings + r.outreach_outings, reports: a.reports + r.reports,
  }), { attendance: 0, prayer_minutes: 0, evangelism_minutes: 0, outreach_outings: 0, reports: 0 });
  const thisWeek = weekly.find((w) => w.week_ending === currentWeek?.weekEnding);
  const reportedThisWeek = thisWeek?.campuses_reported ?? 0;
  const max = Math.max(1, ...weekly.map((w) => w[metric]));
  const rows = summary
    .filter((r) => `${r.campus_name} ${r.region}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'campus_name' || key === 'region' ? 1 : -1 }));
  const th = (key: SortKey, label: string) => <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}><button className="sort-button" onClick={() => sortBy(key)}>{label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</button></th>;

  return <>
    <div className="page-heading"><div><div className="eyebrow">EVERY CAMPUS. ONE MISSION.</div><h1>All campuses</h1><p>Welcome, {profile.full_name}. Live totals across {summary.length} universities for the {season.name} season.</p></div>
      <button className="button button-yellow" onClick={() => jump('enter')}>Enter weekly stats<ArrowRight size={18} /></button></div>
    <div className="source-bar"><span><span className="small-dot" />{season.name} · {formatDate(season.start_date)} – {formatDate(season.end_date)}</span><span>{totals.reports} weekly reports recorded</span></div>
    <div className="deadline-banner"><CalendarClock size={22} /><div>
      <strong>{currentWeek ? `Week ending ${formatDate(currentWeek.weekEnding)}: ${reportedThisWeek} of ${summary.length} campuses reported` : 'The reporting season has not started yet'}</strong>
      <p>Reports are due every Friday before {deadlineLabel(season.deadline_hour)} ({season.time_zone} time). Late submissions are labelled; missing weeks are never counted as zero.</p></div></div>
    <section className="management-stats" aria-label="Season totals across all campuses">
      {[{ label: 'Attendance occasions', value: totals.attendance.toLocaleString('en-GB'), Icon: Users },
        { label: 'Prayer time', value: hours(totals.prayer_minutes), Icon: Clock3 },
        { label: 'Evangelism time', value: hours(totals.evangelism_minutes), Icon: Megaphone },
        { label: 'Outreach outings', value: totals.outreach_outings.toLocaleString('en-GB'), Icon: Footprints }].map(({ label, value, Icon }, i) =>
        <div className={`stat-card ${i === 0 ? 'featured' : ''}`} key={label}><div className="stat-top"><span>{label}</span><Icon size={20} /></div><div className="stat-value">{totals.reports ? value : '—'}</div><small>{totals.reports ? 'All campuses, this season' : 'No reports yet'}</small></div>)}
    </section>
    <section className="panel padded">
      <div className="panel-heading"><div><h2>Week by week</h2><p>Combined totals from every campus that reported that week.</p></div></div>
      <div className="management-tabs" role="group" aria-label="Chart statistic">{(Object.keys(metricLabels) as Metric[]).map((m) => <button aria-pressed={metric === m} className={metric === m ? 'active' : ''} key={m} onClick={() => setMetric(m)}>{metricLabels[m]}</button>)}</div>
      {!weekly.length ? <div className="empty-state"><Users size={30} /><h3>No weekly reports yet.</h3><p>Once stats are entered, the season’s progress appears here.</p></div>
        : <div className="live-chart" role="img" aria-label={`${metricLabels[metric]} by week across all campuses`}>{weekly.map((w) =>
          <div className="live-column" key={w.week_ending} title={`${w.campuses_reported} campuses reported`}><strong>{w[metric].toLocaleString('en-GB')}</strong><div className="live-bar" style={{ height: Math.max(2, (w[metric] / max) * 170) }} /><span>{shortDate(w.week_ending)}</span></div>)}</div>}
    </section>
    <section className="panel padded campus-summary">
      <div className="panel-heading"><div><h2>Campus breakdown</h2><p>Select a campus to see its weekly record. Click a column to sort.</p></div>
        <label className="search-box"><Search size={16} /><input placeholder="Search campus or region" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search campuses" /></label></div>
      <div className="management-table-wrap"><table><thead><tr>{th('campus_name', 'Campus')}{th('region', 'Region')}{th('reports', 'Reports')}{th('attendance', 'Attendance')}{th('prayer_minutes', 'Prayer')}{th('evangelism_minutes', 'Evangelism')}{th('outreach_outings', 'Outings')}<th>This week</th><th /></tr></thead>
        <tbody>{rows.map((r) => {
          const done = currentWeek && r.last_week && r.last_week >= currentWeek.weekEnding;
          return <tr key={r.campus_id}>
            <td><button className="link-button" onClick={() => jump('campus', { campusId: r.campus_id })}>{r.campus_name}</button></td>
            <td>{r.region}</td>
            <td>{r.reports}{r.late_reports ? <span className="muted"> ({r.late_reports} late)</span> : ''}</td>
            <td>{r.reports ? r.attendance.toLocaleString('en-GB') : '—'}</td>
            <td>{r.reports ? hours(r.prayer_minutes) : '—'}</td>
            <td>{r.reports ? hours(r.evangelism_minutes) : '—'}</td>
            <td>{r.reports ? r.outreach_outings : '—'}</td>
            <td>{currentWeek ? <span className={`week-status ${done ? 'submitted' : currentWeek.status}`}>{done ? 'submitted' : currentWeek.status}</span> : '—'}</td>
            <td><button className="text-link" onClick={() => jump('enter', { campusId: r.campus_id, weekEnding: currentWeek?.weekEnding })}>Enter stats</button></td>
          </tr>;
        })}</tbody></table></div>
    </section>
  </>;
}
