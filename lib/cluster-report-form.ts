export type ClusterDraft = Record<string, string | string[]>;
export type ClusterQuestion = { id: string; label: string; kind: 'text' | 'date' | 'time' | 'duration' | 'count' | 'decision' | 'nature'; required?: boolean; when?: string; answer?: 'yes' | 'no' };
const field = (id: string, label: string, kind: ClusterQuestion['kind'] = 'text', required = false): ClusterQuestion => ({ id, label, kind, required });
const issue = (id: string, label: string, required = true, descriptionRequired = true, answer: 'yes' | 'no' = 'yes'): ClusterQuestion[] => [field(id, label, 'decision', required), { ...field(`${id}.description`, 'Please explain', 'text', descriptionRequired), when: id, answer }];
export const clusterAreas = [
  { id: 'session', title: 'KOC Session', required: true, questions: [field('session.leader', 'Who led the session?'), field('session.date', 'Date of session', 'date'), field('session.start', 'Start time', 'time'), field('session.finish', 'Finish time', 'time'), field('session.lesson', 'Lesson (week number: title, or Kickback)'), ...issue('session.atmosphere', 'Were there issues with the atmosphere?', false), ...issue('session.core', 'Were there issues with core involvement?', false, false), ...issue('session.engagement', 'Were there issues with member engagement?', false, false), ...issue('session.organisation', 'Were there issues with session organisation?', false), ...issue('session.positives', 'Were there positives to highlight?', false, false), ...issue('session.concerns', 'Were there other concerns?', false, false)] },
  { id: 'evangelism', title: 'Evangelism', required: false, questions: [field('evangelism.date', 'Date of evangelism', 'date'), field('evangelism.duration', 'Evangelism duration (minutes)', 'duration', true), field('evangelism.members', 'Members who attended evangelism', 'count', true), field('evangelism.souls', 'Souls won', 'count', true), field('evangelism.contacts', 'Contacts taken', 'count', true), field('evangelism.issues', 'Were there any evangelism issues?', 'decision'), ...issue('evangelism.word', 'Issues with Word content?', false).map(q => q.when ? q : { ...q, when: 'evangelism.issues', answer: 'yes' as const }), ...issue('evangelism.confidence', 'Issues with member or leader confidence?', false).map(q => q.when ? q : { ...q, when: 'evangelism.issues', answer: 'yes' as const }), ...issue('evangelism.other', 'Other evangelism issues?', false).map(q => q.when ? q : { ...q, when: 'evangelism.issues', answer: 'yes' as const })] },
  { id: 'prayer', title: 'Prayer Meeting', required: true, questions: [field('prayer.date', 'Date of prayer meeting', 'date', true), field('prayer.duration', 'Prayer meeting duration (minutes)', 'duration', true), field('prayer.attendees', 'Prayer meeting attendees', 'count', true), ...issue('prayer.intensity', 'Issues with intensity or enthusiasm?'), ...issue('prayer.resistance', 'Areas of concern or resistance?'), ...issue('prayer.topics', 'Issues with prayer topics or scriptures?')] },
  { id: 'followup', title: 'Follow Up', required: false, questions: [field('followup.date', 'Date of follow up', 'date'), field('followup.nature', 'Nature of follow up', 'nature'), field('followup.duration', 'Follow up duration (minutes)', 'duration', true), ...issue('followup.accountability', 'Accountability issues?'), ...issue('followup.academic', 'Academic progress issues?'), ...issue('followup.organisation', 'Organisation or daily routine issues?'), ...issue('followup.financial', 'Financial issues?'), ...issue('followup.familial', 'Familial issues?')] },
  { id: 'core', title: 'Core Team Meeting', required: true, questions: [field('core.date', 'Date of core team meeting', 'date'), field('core.members', 'Total core team members', 'count', true), field('core.nature', 'Nature of core team meeting', 'nature'), field('core.duration', 'Core team meeting duration (minutes)', 'duration', true), ...issue('core.organised', 'Was the meeting well organised?', true, true, 'no'), ...issue('core.planning', 'Fellowship planning issues?'), ...issue('core.weight', 'Members not pulling their weight?').map(q => q.id.endsWith('.description') ? { ...q, label: 'List the members' } : q), ...issue('core.financial', 'Financial concerns?'), ...issue('core.academic', 'Academic concerns?'), ...issue('core.prayer', 'Prayer concerns?'), field('core.attended', 'Core members who attended', 'count', true), field('core.missing', 'Core members missing', 'count', true)] },
  { id: 'incident', title: 'Incident', required: true, questions: [{ ...field('incident.description', 'Describe the incident', 'text', true) }] },
] as const;
export function visibleQuestions(draft: ClusterDraft, area: typeof clusterAreas[number]): ClusterQuestion[] {
  if (draft[area.id] !== 'yes') return [];
  const visible = new Set<string>();
  return area.questions.filter(q => {
    const show = !q.when || (draft[q.when] === q.answer && visible.has(q.when));
    if (show) visible.add(q.id);
    return show;
  });
}
export function sanitizeClusterDraft(draft: ClusterDraft): ClusterDraft {
  const clean: ClusterDraft = { scope: draft.scope || 'cluster', campusId: draft.campusId || '', areas: draft.scope === 'campus' ? clusterAreas.map(a => a.id) : Array.isArray(draft.areas) ? draft.areas.filter(id => clusterAreas.some(a => a.id === id)) : [] };
  for (const area of clusterAreas) if ((clean.areas as string[]).includes(area.id)) {
    if (draft[area.id]) clean[area.id] = draft[area.id];
    for (const q of visibleQuestions(draft, area)) if (draft[q.id] !== undefined) clean[q.id] = draft[q.id];
  }
  return clean;
}
export function validateClusterDraft(draft: ClusterDraft, context: { campusIds: string[] }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!['cluster', 'campus'].includes(String(draft.scope))) errors.scope = 'Choose the reporting scope.';
  if ((draft.scope === 'campus' || draft.campusId) && !context.campusIds.includes(String(draft.campusId))) errors.campusId = 'Choose a campus in your cluster.';
  if (!Array.isArray(draft.areas) || !draft.areas.length || draft.areas.some(id => !clusterAreas.some(a => a.id === id))) errors.areas = 'Choose at least one reporting area.';
  for (const area of clusterAreas) if (Array.isArray(draft.areas) && draft.areas.includes(area.id)) {
    if (area.required && !['yes', 'no'].includes(String(draft[area.id]))) errors[area.id] = 'Choose Yes or No.';
    for (const q of visibleQuestions(draft, area)) {
      const value = String(draft[q.id] ?? '').trim();
      if (!value && q.required) errors[q.id] = 'This answer is required.';
      else if (value && (q.kind === 'count' || q.kind === 'duration') && (!Number.isFinite(Number(value)) || Number(value) < 0 || (q.kind === 'count' && !Number.isInteger(Number(value))))) errors[q.id] = q.kind === 'count' ? 'Use a whole number of zero or more.' : 'Use minutes of zero or more.';
      else if (value && q.kind === 'decision' && !['yes', 'no'].includes(value)) errors[q.id] = 'Choose Yes or No.';
      else if (value && q.kind === 'nature' && !['inperson', 'virtual'].includes(value)) errors[q.id] = 'Choose in person or virtual.';
      else if (value && q.kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)) errors[q.id] = 'Choose a valid date.';
      else if (value && q.kind === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors[q.id] = 'Choose a valid time.';
      else if (value.length > 4000) errors[q.id] = 'Keep the answer under 4000 characters.';
    }
  }
  return errors;
}
