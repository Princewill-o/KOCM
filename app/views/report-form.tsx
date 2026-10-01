'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { listReports, submitReport, friendly, type Profile, type Campus, type Report } from '@/lib/koc';
import { buildWeeks, deadlineLabel, formatDate, type Season } from '@/lib/reporting';

// Empty boxes must stay empty (never silently become 0).
const whole = (label: string, max: number) => z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number({ required_error: `Enter ${label}.`, invalid_type_error: `Enter ${label}.` }).int('Use a whole number.').min(0, 'Use zero or more.').max(max, 'That number is too large.'),
);
const schema = z.object({
  weekEnding: z.string().min(1, 'Choose a reporting week.'),
  attendance: whole('attendance', 100000),
  prayerMinutes: whole('prayer minutes', 1000000),
  evangelismMinutes: whole('evangelism minutes', 1000000),
  outreachOutings: whole('the number of outings', 10000),
  notes: z.string().max(2000, 'Keep notes under 2000 characters.'),
});
type Fields = z.output<typeof schema>;
const fields = [
  { key: 'attendance', label: 'Attendance', help: 'Total people attending the campus gathering' },
  { key: 'prayerMinutes', label: 'Prayer time (minutes)', help: 'Total prayer duration, e.g. 90 for 1h 30m' },
  { key: 'evangelismMinutes', label: 'Evangelism time (minutes)', help: 'Total outreach activity duration' },
  { key: 'outreachOutings', label: 'Number of outreach outings', help: 'How many times the team stepped out' },
] as const;

type Props = { season: Season; profile: Profile; campuses: Campus[]; campusId: string; setCampusId: (id: string) => void; initialWeek?: string };

export default function ReportForm({ season, profile, campuses, campusId, setCampusId, initialWeek }: Props) {
  const isRep = profile.role === 'campus';
  const id = isRep ? profile.campus_id ?? '' : campusId;
  const campus = campuses.find((c) => c.id === id);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const reportsRef = useRef<Report[] | null>(null);
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, Fields>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    reportsRef.current = null; setReports(null); setMessage(''); setError('');
    listReports(id, season.id).then((r) => {
      if (!alive) return;
      reportsRef.current = r;
      setReports(r);
      const open = buildWeeks(season, r).filter((w) => w.status !== 'upcoming');
      const week = initialWeek && open.some((w) => w.weekEnding === initialWeek) ? initialWeek
        : open.find((w) => w.status === 'due')?.weekEnding ?? open.at(-1)?.weekEnding ?? '';
      reset(valuesFor(week, r));
    }).catch((e) => { if (alive) setError(friendly(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, season]);

  const weeks = useMemo(() => (reports ? buildWeeks(season, reports).filter((w) => w.status !== 'upcoming') : []), [reports, season]);
  const selected = watch('weekEnding');

  // Prefill the numbers whenever a different week is picked.
  useEffect(() => { if (reportsRef.current && selected) reset(valuesFor(selected, reportsRef.current)); }, [selected, reset]);

  async function submit(values: Fields) {
    setError(''); setMessage('');
    try {
      const saved = await submitReport({ ...values, campusId: isRep ? null : id });
      const next = [...(reportsRef.current ?? []).filter((r) => r.id !== saved.id), saved];
      reportsRef.current = next;
      setReports(next);
      setMessage(`Saved ${campus?.name ?? 'campus'} — week ending ${formatDate(values.weekEnding)}${saved.is_late ? ' (recorded as late)' : ''}.`);
    } catch (e) {
      setError(friendly(e));
    }
  }

  const existing = reports?.find((r) => r.week_ending === selected);

  return <>
    <div className="page-heading"><div><div className="eyebrow">{isRep ? 'YOUR WEEK' : 'STATS ENTRY'}</div><h1>{isRep ? 'Record your week' : 'Enter weekly stats'}</h1>
      <p>{isRep ? `${campus?.name ?? profile.campus?.name ?? ''} · ` : ''}Enter 0 only when no activity took place. Saving an existing week updates it.</p></div></div>
    <section className="panel padded report-panel">
      {!id && !isRep ? <p>Select a campus to begin.</p> : <form className="management-form" onSubmit={handleSubmit(submit)} noValidate>
        <div className="report-fields">
          {!isRep && <label>University<select value={id} onChange={(e) => setCampusId(e.target.value)}>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          <label>Week ending Friday
            <select {...register('weekEnding')} disabled={!reports || !weeks.length}>
              {!reports ? <option>Loading weeks…</option> : !weeks.length ? <option value="">Reporting opens with the first week of the season</option>
                : [...weeks].reverse().map((w) => <option key={w.weekEnding} value={w.weekEnding}>{formatDate(w.weekEnding)} · {w.status}</option>)}
            </select>
            <small>Due Friday before {deadlineLabel(season.deadline_hour)} UK time{existing ? ` · last updated ${new Date(existing.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</small>
            {errors.weekEnding && <small className="form-error">{errors.weekEnding.message}</small>}
          </label>
        </div>
        <div className="report-fields">{fields.map((f) => <label key={f.key}>{f.label}<Input type="number" inputMode="numeric" min="0" step="1" {...register(f.key)} /><small>{f.help}</small>{errors[f.key] && <small className="form-error">{errors[f.key]?.message}</small>}</label>)}</div>
        <label>Notes (optional)<textarea rows={3} maxLength={2000} placeholder="What happened this week? Any events or context behind the numbers?" {...register('notes')} />{errors.notes && <small className="form-error">{errors.notes.message}</small>}</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p role="status" className="success-message">{message}</p>}
        <button disabled={isSubmitting || !reports || !weeks.length} className="button button-yellow">{isSubmitting ? 'Saving…' : existing ? 'Update weekly report' : 'Save weekly report'}<ArrowRight size={18} /></button>
        <small>Reports saved after the Friday deadline are marked late. Every save is kept in the audit history.</small>
      </form>}
    </section>
  </>;
}

function valuesFor(week: string, reports: Report[]): z.input<typeof schema> {
  const r = reports.find((x) => x.week_ending === week);
  return {
    weekEnding: week,
    attendance: r?.attendance ?? '',
    prayerMinutes: r?.prayer_minutes ?? '',
    evangelismMinutes: r?.evangelism_minutes ?? '',
    outreachOutings: r?.outreach_outings ?? '',
    notes: r?.notes ?? '',
  };
}
