import { describe, expect, it } from 'vitest';
import { validateClusterDraft, sanitizeClusterDraft } from '../lib/cluster-report-form';
const context = { campusIds: ['own-campus'] };
describe('cluster form decisions', () => {
  it('requires a scoped campus for individual reports', () => {
    expect(validateClusterDraft({ scope: 'campus', campusId: 'other', areas: ['incident'], incident: 'no' }, context).campusId).toBeTruthy();
  });
  it('requires explanations on yes and removes stale answers on no', () => {
    expect(validateClusterDraft({ scope: 'cluster', areas: ['incident'], incident: 'yes' }, context)['incident.description']).toBeTruthy();
    expect(sanitizeClusterDraft({ scope: 'cluster', areas: ['incident'], incident: 'no', 'incident.description': 'private old answer' })['incident.description']).toBeUndefined();
  });
  it('rejects negative durations and fractional counts', () => {
    const errors = validateClusterDraft({ scope: 'cluster', areas: ['evangelism'], evangelism: 'yes', 'evangelism.duration': '-1', 'evangelism.members': '1.5' }, context);
    expect(errors['evangelism.duration']).toBeTruthy(); expect(errors['evangelism.members']).toBeTruthy();
  });
  it('uses the reversed organisation decision', () => {
    expect(validateClusterDraft({ scope: 'cluster', areas: ['core'], core: 'yes', 'core.organised': 'no' }, context)['core.organised.description']).toBeTruthy();
    expect(sanitizeClusterDraft({ scope: 'cluster', areas: ['core'], core: 'yes', 'core.organised': 'yes', 'core.organised.description': 'old' })['core.organised.description']).toBeUndefined();
  });
});
it('removes nested evangelism concerns when the issues gate is no', () => {
  expect(sanitizeClusterDraft({ scope: 'cluster', areas: ['evangelism'], evangelism: 'yes', 'evangelism.issues': 'no', 'evangelism.word': 'yes', 'evangelism.word.description': 'Old issue' })['evangelism.word.description']).toBeUndefined();
});
it('requires all prayer details only when prayer took place', () => {
  expect(Object.keys(validateClusterDraft({ scope: 'cluster', areas: ['prayer'], prayer: 'yes' }, context))).toEqual(expect.arrayContaining(['prayer.date', 'prayer.duration', 'prayer.attendees', 'prayer.intensity', 'prayer.resistance', 'prayer.topics']));
  expect(validateClusterDraft({ scope: 'cluster', areas: ['prayer'], prayer: 'no' }, context)).toEqual({});
});
