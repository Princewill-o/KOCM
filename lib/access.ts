import type { Profile, Campus } from './koc';
export type Tab = 'overview' | 'campus' | 'enter' | 'accounts' | 'profile' | 'grades' | 'contacts' | 'materials' | 'notifications' | 'quarters';
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
    {id:'grades',label:'Grades'}, {id:'contacts',label:'People'}, {id:'materials',label:'Materials'},
    {id:'notifications',label:'Notifications'},
    ...(p.role === 'admin' ? [{id:'accounts' as Tab,label:'Accounts'}] : []),
    {id:'profile',label:'My profile'},
  ];
}
