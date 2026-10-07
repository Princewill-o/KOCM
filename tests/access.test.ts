import { describe, expect, it } from 'vitest';
import { tabsFor, statsCampuses, navigationFor } from '../lib/access';
import type { Profile, Campus } from '../lib/koc';
const profile = (role: Profile['role'], status: Profile['status'] = 'active'): Profile => ({ id:'u',full_name:'User',email:'user@example.test',role,status,campus_id:'own',cluster_id:'north',created_at:'' });
const campuses: Campus[] = [{id:'own',name:'Own',region:'North',cluster_id:'north'},{id:'other',name:'Other',region:'London',cluster_id:'london'}];
describe('workspace permissions', () => {
  it('exposes campus lead profiles only to active administrators', () => {
    for (const role of ['admin', 'editor', 'cluster', 'campus'] as const) {
      for (const status of ['active', 'pending', 'rejected'] as const) {
        expect(tabsFor(profile(role, status)).some(tab => tab.id === 'map')).toBe(role === 'admin' && status === 'active');
      }
    }
  });
  it('groups all accessible pages into at most five main destinations', () => {
    for (const role of ['admin', 'editor', 'cluster', 'campus'] as const) {
      const p = profile(role);
      for (const tab of tabsFor(p)) {
        const nav = navigationFor(p, tab.id);
        expect(nav.primary.length).toBeLessThanOrEqual(5);
        expect(nav.primary.map(t => t.id)).toContain(nav.active);
        expect(nav.secondary.map(t => t.id)).toContain(tab.id);
        expect(nav.secondary.every(t => tabsFor(p).some(a => a.id === t.id))).toBe(true);
      }
      expect(navigationFor(p, 'campus').primary.map(t => t.id)).not.toContain('map');
    }
  });
  it('places related pages under their section, with admin profiles under Campuses', () => {
    const p = profile('admin');
    expect(navigationFor(p, 'map').active).toBe('campus');
    expect(navigationFor(p, 'map').secondary.map(t => t.id)).toEqual(['campus', 'enter', 'grades', 'contacts', 'map']);
    expect(navigationFor(p, 'quarters').active).toBe('overview');
    expect(navigationFor(p, 'accounts').active).toBe('profile');
    expect(navigationFor(p, 'profile').primary.map(t => t.id)).toEqual(['overview', 'campus', 'materials', 'notifications', 'profile']);
  });
  it('campus users only get their own statistics and weekly form', () => {
    expect(statsCampuses(profile('campus'), campuses).map(c=>c.id)).toEqual(['own']);
    expect(tabsFor(profile('campus')).map(t=>t.id)).toContain('enter');
    expect(tabsFor(profile('campus')).map(t=>t.id)).not.toContain('quarters');
  });
  it('cluster leads submit weekly stats only for assigned campuses', () => {
    expect(statsCampuses(profile('cluster'),campuses).map(c=>c.id)).toEqual(['own']);
    expect(tabsFor(profile('cluster')).map(t=>t.id)).toContain('enter');
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
