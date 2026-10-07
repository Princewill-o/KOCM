'use client';
import { useState } from 'react';
import type { Campus, Profile } from '@/lib/koc';
import { clusterAreas, sanitizeClusterDraft, validateClusterDraft, visibleQuestions, type ClusterDraft, type ClusterQuestion } from '@/lib/cluster-report-form';

type Props = { profile: Profile; campuses: Campus[]; clusters?: { id: string; name: string }[] };
export default function ClusterReportForm({ profile, campuses, clusters = [] }: Props) {
  const ownCampuses = campuses.filter(c => Boolean(profile.cluster_id) && c.cluster_id === profile.cluster_id);
  const clusterName = clusters.find(c => c.id === profile.cluster_id)?.name ?? ownCampuses[0]?.region ?? 'Your assigned cluster';
  const [draft, setDraft] = useState<ClusterDraft>({ scope: 'cluster', campusId: '', areas: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  function change(id: string, value: string | string[]) {
    setDraft(current => sanitizeClusterDraft({ ...(id === 'scope' || id === 'campusId' ? { scope: current.scope, campusId: '', areas: [] } : current), [id]: value }));
    setErrors({}); setReview(false);
  }
  function reviewAnswers() {
    const found = validateClusterDraft(draft, { campusIds: ownCampuses.map(c => c.id) });
    setErrors(found);
    if (!Object.keys(found).length) setReview(true);
  }
  function error(id: string) { return errors[id] ? <p id={`error-${id}`} role="alert" style={{ color: 'var(--destructive, #bd3737)' }}>{errors[id]}</p> : null; }
  function question(q: ClusterQuestion) {
    const common = { id: q.id, value: String(draft[q.id] ?? ''), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => change(q.id, event.target.value), 'aria-invalid': Boolean(errors[q.id]), 'aria-describedby': errors[q.id] ? `error-${q.id}` : undefined, required: q.required, className: 'input' };
    return <div key={q.id} style={{ marginTop: 18 }}><label htmlFor={q.id}>{q.label}{q.required ? ' *' : ' (optional)'}</label>{q.kind === 'decision' || q.kind === 'nature' ? <select {...common}><option value="">Choose an answer</option>{q.kind === 'decision' ? <><option value="yes">Yes</option><option value="no">No</option></> : <><option value="inperson">In person</option><option value="virtual">Virtual</option></>}</select> : q.kind === 'text' ? <textarea {...common} rows={3} maxLength={4000} /> : <input {...common} type={q.kind === 'duration' || q.kind === 'count' ? 'number' : q.kind} min={q.kind === 'duration' || q.kind === 'count' ? 0 : undefined} step={q.kind === 'count' ? 1 : q.kind === 'duration' ? 'any' : undefined} />}{error(q.id)}</div>;
  }
  return <section className="panel" style={{ maxWidth: 850, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
    <h2>Cluster report</h2>
    <p role="status"><strong>Form preview — nothing is submitted.</strong> Answers remain only in this page and disappear when you leave or reload.</p>
    <p>Use this form to review activity and concerns in your cluster. Questions marked * are required for review.</p>
    <p><strong>Cluster lead:</strong> {profile.full_name}<br /><strong>Cluster:</strong> {clusterName}</p>
    {review ? <div><h3>Review your answers</h3><p><strong>Scope:</strong> {draft.scope === 'cluster' ? 'Whole cluster' : 'Individual campus'}</p><p><strong>Campus:</strong> {ownCampuses.find(c => c.id === draft.campusId)?.name ?? 'N/A'}</p>{clusterAreas.filter(a => (draft.areas as string[]).includes(a.id)).map(area => <section key={area.id} style={{ marginTop: 24 }}><h3>{area.title}</h3><p>{draft[area.id] === 'yes' ? 'Yes' : draft[area.id] === 'no' ? 'No' : 'Not answered'}</p><dl>{visibleQuestions(draft, area).map(q => <div key={q.id} style={{ marginBottom: 12 }}><dt><strong>{q.label}</strong></dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft[q.id] ? String(draft[q.id]) : 'Not answered'}</dd></div>)}</dl></section>)}<button type="button" className="button button-yellow" onClick={() => setReview(false)}>Back to edit</button><p>No report has been sent or saved.</p></div> : <div>
      <div><label htmlFor="cluster-report-scope">Report scope *</label><select id="cluster-report-scope" className="input" value={String(draft.scope)} onChange={e => change('scope', e.target.value)}><option value="cluster">Whole cluster</option><option value="campus">Individual campus</option></select>{error('scope')}</div>
      <div style={{ marginTop: 18 }}><label htmlFor="cluster-report-campus">{draft.scope === 'campus' ? 'Campus *' : 'Campus visited (optional)'}</label><select id="cluster-report-campus" className="input" value={String(draft.campusId)} onChange={e => change('campusId', e.target.value)}><option value="">{draft.scope === 'campus' ? 'Choose a campus' : 'N/A — whole cluster'}</option>{ownCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{error('campusId')}</div>
      {draft.scope === 'cluster' && <fieldset style={{ marginTop: 24, border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><legend>Reporting areas *</legend><p>Select the areas you want to report on.</p>{clusterAreas.map(a => <label key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={(draft.areas as string[]).includes(a.id)} onChange={e => change('areas', e.target.checked ? [...draft.areas as string[], a.id] : (draft.areas as string[]).filter(id => id !== a.id))} />{a.title}</label>)}{error('areas')}</fieldset>}
      {clusterAreas.filter(a => (draft.areas as string[]).includes(a.id)).map(area => <fieldset key={area.id} style={{ marginTop: 24, border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><legend>{area.title}</legend>{question({ id: area.id, label: area.id === 'incident' ? 'Do you want to report any other issues regarding KOC?' : `Do you want to report on ${area.title}?`, kind: 'decision', required: area.required })}{visibleQuestions(draft, area).map(question)}</fieldset>)}
      {Object.keys(errors).length > 0 && <p role="alert">Check the highlighted questions before reviewing.</p>}
      <button type="button" className="button button-yellow" style={{ marginTop: 24 }} onClick={reviewAnswers}>Review answers</button>
    </div>}
  </section>;
}
