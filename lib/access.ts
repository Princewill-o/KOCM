import type { Profile, Campus } from './koc';
export type Tab = 'overview' | 'campus' | 'enter' | 'accounts' | 'profile' | 'grades' | 'contacts' | 'materials' | 'notifications' | 'quarters' | 'map';
export function navigationFor(profile: Profile, current: Tab) {
  const allowed = tabsFor(profile);
  const hasOverview = allowed.some(t => t.id === 'overview');
  const parent = (id: Tab): Tab => {
    if (id === 'quarters') return hasOverview ? 'overview' : 'campus';
    if (id === 'enter' || id === 'grades' || id === 'contacts' || id === 'map') return 'campus';
    if (id === 'accounts') return 'profile';
    return id;
  };
  const active = parent(current);
  return {
    active,
    primary: allowed.filter(t => parent(t.id) === t.id),
    secondary: allowed.filter(t => parent(t.id) === active),
  };
}
export function statsCampuses(profile: Profile, campuses: Campus[]) {
  if (profile.status !== 'active') return [];
  if (profile.role === 'campus') return campuses.filter(c => c.id === profile.campus_id);
  if (profile.role === 'cluster') return campuses.filter(c => !!profile.cluster_id && c.cluster_id === profile.cluster_id);
  return campuses;
}
export function tabsFor(p: Profile): { id: Tab; label: string }[] {
  if (p.status !== 'active') return [{id:'profile',label:'My profile'}];
  return [
    ...(p.role === 'admin' || p.role === 'editor' ? [{id:'overview' as Tab,label:'Overview'}] : []),
    {id:'campus',label:p.role === 'campus' ? 'My campus' : p.role === 'cluster' ? 'My cluster' : 'Campuses'},
    {id:'enter',label:'Weekly report'},
    ...(p.role !== 'campus' ? [{id:'quarters' as Tab,label:'Quarterly trends'}] : []),
    {id:'grades',label:'Grades'}, {id:'contacts',label:'People'},
    ...(p.role === 'admin' ? [{id:'map' as Tab,label:'Campus lead profiles'}] : []),
    {id:'materials',label:'Materials'},
    {id:'notifications',label:'Alerts'},
    ...(p.role === 'admin' ? [{id:'accounts' as Tab,label:'Accounts'}] : []),
    {id:'profile',label:'My profile'},
  ];
}
