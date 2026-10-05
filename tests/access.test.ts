import { describe, expect, it } from 'vitest';
import { tabsFor, statsCampuses } from '../lib/access';
import type { Profile, Campus } from '../lib/koc';
const profile = (role: Profile['role'], status: Profile['status'] = 'active'): Profile => ({ id:'u',full_name:'User',email:'user@example.test',role,status,campus_id:'own',cluster_id:'north',created_at:'' });
const campuses: Campus[] = [{id:'own',name:'Own',region:'North',cluster_id:'north'},{id:'other',name:'Other',region:'London',cluster_id:'london'}];
describe('workspace permissions', () => {
  it('campus users only get their own statistics and weekly form', () => {
    expect(statsCampuses(profile('campus'), campuses).map(c=>c.id)).toEqual(['own']);
    expect(tabsFor(profile('campus')).map(t=>t.id)).toContain('enter');
    expect(tabsFor(profile('campus')).map(t=>t.id)).not.toContain('quarters');
  });
  it('cluster leads read only assigned campuses and cannot enter weekly stats', () => {
    expect(statsCampuses(profile('cluster'),campuses).map(c=>c.id)).toEqual(['own']);
    expect(tabsFor(profile('cluster')).map(t=>t.id)).not.toContain('enter');
    expect(tabsFor(profile('cluster')).map(t=>t.id)).toContain('quarters');
  });
  it('unassigned clusters have no statistics access', () => {
    expect(statsCampuses({...profile('cluster'),cluster_id:null},campuses)).toEqual([]);
  });
  it('pending users only see their profile', () => {
    expect(tabsFor(profile('admin','pending')).map(t=>t.id)).toEqual(['profile']);
    expect(statsCampuses(profile('admin','pending'),campuses)).toEqual([]);
  });
  it('editors see all campuses but cannot manage accounts', () => {
    expect(statsCampuses(profile('editor'),campuses)).toEqual(campuses);
    expect(tabsFor(profile('editor')).map(t=>t.id)).not.toContain('accounts');
  });
});
