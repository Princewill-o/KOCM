'use client';
import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { Campus, Report } from '@/lib/koc';
import { aggregateQuarters, quarterMetrics, type QuarterMetric } from '@/lib/quarters';
export default function QuarterlyTrends({ campuses, reports, loading = false, error = '' }: { campuses: Campus[]; reports: Report[]; loading?: boolean; error?: string }) {
  const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/London' }).format(new Date()));
  const years = [...new Set([currentYear, ...reports.map(r => Number(r.week_ending.slice(0, 4)))])].sort((a, b) => b - a);
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(1);
  const [metric, setMetric] = useState<QuarterMetric>('attendance');
  const rows = useMemo(() => aggregateQuarters(campuses, reports, year), [campuses, reports, year]);
  const totals = [1, 2, 3, 4].map(q => { const submitted = rows.filter(r => r.quarter === q && r.reports > 0); return { label: `Q${q}`, value: submitted.length ? submitted.reduce((sum, r) => sum + (r[metric] ?? 0), 0) : null, reports: submitted.reduce((sum, r) => sum + r.reports, 0) }; });
  return <section>
    <div className="page-heading"><div><h1>Quarterly trends</h1><p>Compare activity across your campuses by calendar quarter.</p></div></div>
    <div className="panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <label>Year <select value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Statistic <select value={metric} onChange={e => setMetric(e.target.value as QuarterMetric)}>{Object.entries(quarterMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Q1 Jan–Mar · Q2 Apr–Jun · Q3 Jul–Sep · Q4 Oct–Dec. Activity totals cover submitted reports only; attendance counts visits, not unique people. Missing reports are shown as “No reports”, never zero activity.</p>
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading quarterly reports…</p> : <>
        <div className="analytics-chart" aria-label={`${quarterMetrics[metric]} by calendar quarter`}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={totals}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} /><Bar dataKey="value" name={quarterMetrics[metric]} fill="#d6b800" isAnimationActive={false} /></BarChart></ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '16px 0 24px' }}>{totals.map(t => <div key={t.label} style={{ flex: '1 1 130px', padding: 14, border: '1px solid var(--border)', borderRadius: 8 }}><strong>{t.label}: {t.value === null ? 'No reports' : t.value.toLocaleString()}</strong><div>{t.reports} reports submitted</div></div>)}</div>
        <label>Campus breakdown <select value={quarter} onChange={e => setQuarter(Number(e.target.value))}>{[1, 2, 3, 4].map(q => <option value={q} key={q}>Q{q}</option>)}</select></label>
        <div style={{ overflowX: 'auto', marginTop: 16 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><caption style={{ textAlign: 'left', paddingBottom: 12 }}>{year} Q{quarter} · submitted activity by campus</caption><thead><tr>{['Campus', 'Region', 'Reports', ...Object.values(quarterMetrics)].map(h => <th key={h} style={{ textAlign: 'left', padding: 12 }}>{h}</th>)}</tr></thead><tbody>{rows.filter(r => r.quarter === quarter).map(r => <tr key={r.campusId}><td style={{ padding: 12 }}>{r.campusName}</td><td>{r.region}</td><td>{r.reports}</td>{(Object.keys(quarterMetrics) as QuarterMetric[]).map(key => <td key={key}>{r[key] === null ? 'No reports' : r[key].toLocaleString()}</td>)}</tr>)}</tbody></table>{campuses.length === 0 && <p>No campuses are assigned to your account yet.</p>}</div>
      </>}
    </div>
  </section>;
}
