'use client';
import { useEffect, useState } from 'react';
import { Users, Clock3, Megaphone, Footprints, CalendarClock, ArrowRight, Pencil, Trash2, Download } from 'lucide-react';
import { listReports, deleteReport, friendly, type Profile, type Campus, type Report } from '@/lib/koc';
import { buildWeeks, deadlineLabel, formatDate, hours, shortDate, type Season } from '@/lib/reporting';
import type { demoData } from '@/lib/demo';
import type { Jump } from '../dashboard';
import { completionRows, downloadWorkbook } from '@/lib/analytics';

type Props = { demo?: ReturnType<typeof demoData>; season: Season; profile: Profile; campuses: Campus[]; campusId: string; setCampusId: (id: string) => void; jump: Jump };

export default function CampusView({ season, profile, campuses, campusId, setCampusId, jump, demo }: Props) {
  const [reports, setReports] = useState<Report[] | null>(demo ? demo.reports.filter(r => r.campus_id === campusId) : null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [exporting, setExporting] = useState(false);
  const isRep = profile.role === 'campus';
  const id = isRep ? profile.campus_id ?? '' : campusId;
  const campus = campuses.find((c) => c.id === id);

  useEffect(() => {
    if (!id || demo) return;
    let alive = true;
    listReports(id, season.id).then((r) => { if (alive) setReports(r); }).catch((e) => { if (alive) setError(friendly(e)); });
    return () => { alive = false; };
  }, [id, season.id, demo]);

  async function remove(r: Report) {
    if (!window.confirm(`Delete the report for week ending ${formatDate(r.week_ending)}? This cannot be undone.`)) return;
    setBusy(r.id); setError('');
    try { await deleteReport(r.id); setReports((prev) => prev?.filter((x) => x.id !== r.id) ?? null); }
    catch (e) { setError(friendly(e)); }
    finally { setBusy(''); }
  }

  const totals = (reports ?? []).reduce((a, r) => ({
    attendance: a.attendance + r.attendance, prayer: a.prayer + r.prayer_minutes, evangelism: a.evangelism + r.evangelism_minutes, outings: a.outings + r.outreach_outings,
  }), { attendance: 0, prayer: 0, evangelism: 0, outings: 0 });
  const weeks = reports ? buildWeeks(season, reports) : [];
  const completed = weeks.filter(w => w.status === 'submitted' || w.status === 'late').length;
  const overdue = weeks.filter(w => w.status === 'missing').length;
  const pending = weeks.filter(w => w.status === 'due').length;
  async function exportExcel() {
    if (!reports) return;
    setExporting(true); setError('');
    const weekly = reports.map(r => ({ ...r, campuses_reported: 1 }));
    try {
      await downloadWorkbook([{ campus_id: id, campus_name: campus?.name ?? 'Campus', region: campus?.region ?? '', reports: reports.length, late_reports: reports.filter(r => r.is_late).length, attendance: totals.attendance, prayer_minutes: totals.prayer, evangelism_minutes: totals.evangelism, outreach_outings: totals.outings, last_week: [...reports].sort((a, b) => b.week_ending.localeCompare(a.week_ending))[0]?.week_ending ?? null }], weekly, completionRows(season, 1, weekly), season, !!demo, reports);
    } catch { setError('The Excel download failed. Please try again.'); }
    finally { setExporting(false); }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">CAMPUS REPORTING</div><h1>{campus?.name ?? profile.campus?.name ?? 'Campus'}</h1><p>{campus?.region ? `${campus.region} · ` : ''}Weekly reports and fellowship activity.</p></div>
      {!isRep && <label className="campus-picker">View campus<select value={id} onChange={(e) => setCampusId(e.target.value)}>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    </div>
    {error && <div className="management-alert" role="alert">{error}</div>}
    {!reports ? (!error && <p role="status" className="loading-line">Loading campus reports…</p>) : <>
      <div className="source-bar"><span><span className="small-dot" />{season.name} · {formatDate(season.start_date)} – {formatDate(season.end_date)}</span><span>{reports.length} {demo ? 'sample reports' : 'weekly reports submitted'}</span></div>
      <div className="deadline-banner"><CalendarClock size={22} /><div><strong>Every Friday, before {deadlineLabel(season.deadline_hour)}</strong><p>{season.time_zone} time. Late submissions are recorded as late; missing weeks stay unreported.</p></div>
        {profile.role !== 'cluster' && <button className="text-button" onClick={() => jump('enter', { campusId: id })}>{isRep ? 'Update this week' : 'Enter stats for this campus'} <ArrowRight size={16} /></button>}</div>
      <section className="management-stats" aria-label="Campus totals">
        {[{ label: 'Attendance occasions', value: totals.attendance.toLocaleString('en-GB'), Icon: Users }, { label: 'Prayer time', value: hours(totals.prayer), Icon: Clock3 },
          { label: 'Evangelism time', value: hours(totals.evangelism), Icon: Megaphone }, { label: 'Outreach outings', value: totals.outings, Icon: Footprints }].map(({ label, value, Icon }, i) =>
          <div className={`stat-card ${i === 0 ? 'featured' : ''}`} key={label}><div className="stat-top"><span>{label}</span><Icon size={20} /></div><div className="stat-value">{reports.length ? value : '—'}</div><small>{reports.length ? 'Across submitted weeks' : 'No reports yet'}</small></div>)}
      </section>
      <section className="panel padded completion-panel"><div className="panel-heading"><div><h2>Report completion</h2><p>Opened weeks only. Future reports are excluded.</p></div><button className="button" disabled={exporting} onClick={exportExcel}><Download size={17} />{exporting ? 'Preparing Excel…' : 'Download Excel'}</button></div><div className="completion-cards"><div><span>Expected</span><strong>{completed + overdue + pending}</strong></div><div><span>Completed</span><strong>{completed}</strong></div><div><span>Outstanding</span><strong>{overdue + pending}</strong></div><div><span>Overdue</span><strong>{overdue}</strong></div></div><p className="completion-caption">{pending} reports still within the Friday deadline.</p></section>
      <Trends reports={reports} />
      <section className="panel padded reporting-history"><h2>Weekly record</h2><p>Attendance counts visits, not unique people. Minutes are entered as total activity duration.</p>
        <div className="management-table-wrap"><table><thead><tr><th>Week ending</th><th>Status</th><th>Attendance</th><th>Prayer</th><th>Evangelism</th><th>Outings</th><th>Notes</th><th /></tr></thead>
          <tbody>{weeks.map((w) => {
            const r = reports.find((x) => x.week_ending === w.weekEnding);
            return <tr key={w.weekEnding}>
              <td>{formatDate(w.weekEnding)}</td><td><span className={`week-status ${w.status}`}>{w.status}</span></td>
              <td>{r?.attendance ?? '—'}</td><td>{r ? hours(r.prayer_minutes) : '—'}</td><td>{r ? hours(r.evangelism_minutes) : '—'}</td><td>{r?.outreach_outings ?? '—'}</td>
              <td className="notes-cell" title={r?.notes}>{r?.notes || '—'}</td>
              <td className="row-actions">{!demo && profile.role !== 'cluster' && w.status !== 'upcoming' && <button className="icon-text" onClick={() => jump('enter', { campusId: id, weekEnding: w.weekEnding })} aria-label={`${r ? 'Edit' : 'Add'} week ending ${formatDate(w.weekEnding)}`}><Pencil size={14} />{r ? 'Edit' : 'Add'}</button>}
                {!demo && r && profile.role === 'admin' && <button className="icon-text danger" disabled={busy === r.id} onClick={() => remove(r)} aria-label={`Delete week ending ${formatDate(w.weekEnding)}`}><Trash2 size={14} /></button>}</td>
            </tr>;
          })}</tbody></table></div>
      </section>
    </>}
  </>;
}

function Trends({ reports }: { reports: Report[] }) {
  const [metric, setMetric] = useState<'attendance' | 'prayer_minutes' | 'evangelism_minutes' | 'outreach_outings'>('attendance');
  const labels = { attendance: 'Attendance', prayer_minutes: 'Prayer minutes', evangelism_minutes: 'Evangelism minutes', outreach_outings: 'Outreach outings' };
  const sorted = [...reports].sort((a, b) => a.week_ending.localeCompare(b.week_ending));
  const max = Math.max(1, ...sorted.map((r) => r[metric]));
  const nextOf = (r: Report) => { const d = new Date(`${r.week_ending}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return sorted.find((x) => x.week_ending === d.toISOString().slice(0, 10)); };
  const pairs = sorted.filter((r) => nextOf(r)).length;
  return <div className="management-charts">
    <section className="panel padded"><div className="panel-heading"><div><h2>Campus activity</h2><p>Only this campus’s submitted reports appear here.</p></div></div>
      <div className="management-tabs" role="group" aria-label="Chart statistic">{(Object.keys(labels) as (keyof typeof labels)[]).map((m) => <button aria-pressed={metric === m} className={metric === m ? 'active' : ''} key={m} onClick={() => setMetric(m)}>{labels[m]}</button>)}</div>
      {!sorted.length ? <div className="empty-state"><Users size={30} /><h3>No weekly reports yet.</h3><p>Submit weekly statistics to see progress through May.</p></div>
        : <div className="live-chart" role="img" aria-label={`${labels[metric]} by submitted week`}>{sorted.map((r) => <div className="live-column" key={r.id}><strong>{r[metric]}</strong><div className="live-bar" style={{ height: Math.max(2, (r[metric] / max) * 170) }} /><span>{shortDate(r.week_ending)}</span></div>)}</div>}
      <p className="chart-explainer">Missing weeks are not treated as zero.</p></section>
    <section className="panel padded"><span className="eyebrow">OUTREACH</span><h2>Outreach and attendance</h2><p>Compare each week’s outings with attendance that week and the following week.</p>
      {pairs < 3 ? <div className="empty-state"><Footprints size={30} /><h3>Building the picture.</h3><p>At least three consecutive week comparisons are needed before interpreting a pattern. {pairs} available so far.</p></div>
        : <p className="insight-note">{pairs} consecutive week comparisons. Look for whether higher outreach activity is followed by higher attendance.</p>}
      {!!sorted.length && <div className="management-table-wrap"><table><thead><tr><th>Week</th><th>Outings</th><th>Attendance</th><th>Next week</th></tr></thead><tbody>{sorted.map((r) => <tr key={r.id}><td>{shortDate(r.week_ending)}</td><td>{r.outreach_outings}</td><td>{r.attendance}</td><td>{nextOf(r)?.attendance ?? '—'}</td></tr>)}</tbody></table></div>}
      <p className="chart-explainer">A relationship is not proof that outreach caused a change. Events, term dates, and other factors also affect attendance.</p></section>
  </div>;
}
