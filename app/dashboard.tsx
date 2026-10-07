'use client';
import BrandLogo from '@/components/ui/brand-logo';
import { useCallback, useEffect, useState } from 'react';
import { LogOut, LayoutDashboard, Building2, ClipboardPen, UsersRound, UserRound, GraduationCap, BookOpen, Bell, ChartNoAxesCombined, ContactRound, MapPin } from 'lucide-react';
import FloatingNav from './components/floating-nav';
import { ThemeToggle } from './theme';
import { supabase } from '@/lib/supabase';
import { currentProfile, currentSeason, listCampuses, signOut, canSeeAllCampuses, ROLE_LABELS, friendly, type Profile, type Campus } from '@/lib/koc';
import type { Season } from '@/lib/reporting';
import Overview from './views/overview';
import CampusView from './views/campus-view';
import CampusNetwork from './views/campus-network';
import ReportForm from './views/report-form';
import Accounts from './views/accounts';
import ProfileView from './views/profile';
import './management.css';
import './features.css';
import './dashboard-polish.css';
import {LiquidButton} from '@/components/ui/liquid-glass-button';
import AgentDock from '@/components/ui/agent-dock';

export type { Tab } from '@/lib/access';
import { tabsFor, statsCampuses, navigationFor, type Tab } from '@/lib/access';
import { listTrendReports, unreadNotificationCount } from '@/lib/platform';
import type { Report } from '@/lib/koc';
import Grades from './views/grades';
import Contacts from './views/contacts';
import Materials from './views/materials';
import Notifications from './views/notifications';
import QuarterlyTrends from './views/quarterly-trends';
export type Jump = (tab: Tab, opts?: { campusId?: string; weekEnding?: string }) => void;
const navIcons = { overview: LayoutDashboard, campus: Building2, enter: ClipboardPen, accounts: UsersRound, profile: UserRound, grades: GraduationCap, contacts: ContactRound, materials: BookOpen, notifications: Bell, quarters: ChartNoAxesCombined, map: MapPin };

function QuarterView({campuses}: {campuses: Campus[]}) {
  const [reports,setReports] = useState<Report[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    let alive = true;
    listTrendReports().then(r => { if(alive) setReports(r); }).catch(e => {if(alive) setError(friendly(e));}).finally(()=>{if(alive) setLoading(false);});
    return () => {alive=false;};
  }, []);
  return <QuarterlyTrends campuses={campuses} reports={reports} loading={loading} error={error} />;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [campusId, setCampusId] = useState('');
  const [weekEnding, setWeekEnding] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const p = await currentProfile();
      if (!p) { window.location.replace('/login'); return; }
      setProfile(p);
      const tabs = tabsFor(p);
      const fromHash = window.location.hash.slice(1) as Tab;
      const initialTab = tabs.some((t) => t.id === fromHash) ? fromHash : tabs[0].id;
      setTab(initialTab);
      if (fromHash && fromHash !== initialTab) history.replaceState(null, '', `#${initialTab}`);
      if (p.status === 'active') {
        const [s, c] = await Promise.all([currentSeason(), listCampuses()]);
        setSeason(s); setCampuses(c);
        const visible = statsCampuses(p, c);
        setCampusId(prev => visible.some(c => c.id === prev) ? prev : visible[0]?.id ?? '');
      }
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() only sets state after awaiting Supabase, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const { data } = supabase().auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') window.location.replace('/login'); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (profile?.status !== 'active') return;
    let alive = true;
    const refreshCount = () => unreadNotificationCount().then(count => {if(alive) setUnread(count);}).catch(() => {});
    void refreshCount();
    const timer = window.setInterval(refreshCount, 30000);
    return () => {alive=false; window.clearInterval(timer);};
  }, [profile?.id, profile?.status, tab]);

  const jump: Jump = (next, opts) => {
    if (!profile || !tabsFor(profile).some(t => t.id === next)) return;
    if (opts?.campusId && statsCampuses(profile, campuses).some(c => c.id === opts.campusId)) setCampusId(opts.campusId);
    setWeekEnding(opts?.weekEnding ?? '');
    setTab(next);
    history.replaceState(null, '', `#${next}`);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  async function logout() {
    // The SIGNED_OUT listener above redirects; this is a fallback if it doesn't fire.
    await signOut();
    setTimeout(() => window.location.replace('/login'), 1500);
  }

  const tabs = profile ? tabsFor(profile) : [];
  const navigation = profile ? navigationFor(profile, tab) : { primary: [], secondary: [], active: tab };
  const allAccess = canSeeAllCampuses(profile);
  const visibleCampuses = profile ? statsCampuses(profile, campuses) : [];

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/dashboard"><BrandLogo /></a>

      <div className="header-actions">
        <ThemeToggle />
        {profile && <button className="user-chip" onClick={() => jump('profile')} title="My profile"><span className="user-name">{profile.full_name}</span><span className="role-badge">{ROLE_LABELS[profile.role]}</span></button>}
        <LiquidButton size="sm" className="quiet-link" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></LiquidButton>
      </div>
    </header>
    <FloatingNav items={navigation.primary.map(item => ({ ...item, icon: navIcons[item.id] }))} active={navigation.active} unread={unread} onSelect={next => jump(next)} />
    <main className="workspace">
      <div className="workspace-transition" key={tab}>
      <div className="breadcrumb">Kharis On Campus Management<span>/ {tabs.find((t) => t.id === tab)?.label}</span></div>
      {navigation.secondary.length > 1 && <nav className="section-navigation" aria-label="Section navigation">{navigation.secondary.map(item => <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => jump(item.id)}>{item.label}</button>)}</nav>}
      {error && <div className="management-alert" role="alert">{error}</div>}
      {loading ? <p role="status" className="loading-line">Loading your workspace…</p>
        : !profile ? null
        : profile.status !== 'active' && tab !== 'profile' ? null
        : profile.status !== 'active' ? <>
          <section className="panel approval-panel">
            <span className="eyebrow">CAMPUS ACCESS</span>
            <h1>{profile.status === 'pending' ? 'Your request is being reviewed.' : 'Your access request was declined.'}</h1>
            <p>{profile.status === 'pending'
              ? `An administrator will verify your access to ${profile.campus?.name ?? 'your university'}. Your campus statistics will appear here once approved.`
              : 'Please contact your KOC administrator to confirm your university and access.'}</p>
            <p>Signed in as {profile.email}</p>
            <button className="button button-yellow" onClick={() => window.location.reload()}>Refresh status</button>
          </section>
          <ProfileView profile={profile} onChange={load} />
        </>
        : !season ? <p role="status">Loading season…</p>
        : <>
          {unread > 0 && tab !== 'notifications' && <div className="notification-reminder" role="status"><Bell size={18} /><span>{unread} unread alert{unread === 1 ? '' : 's'} require review.</span><button className="text-button" onClick={() => jump('notifications')}>Review notifications</button></div>}
          {tab === 'overview' && allAccess && <Overview season={season} profile={profile} jump={jump} />}
          {tab === 'campus' && !visibleCampuses.length && <section className="panel padded"><h1>No campuses assigned yet</h1><p>An administrator must assign your campus or cluster before its statistics appear.</p></section>}
          {tab === 'campus' && !!visibleCampuses.length && <CampusView key={campusId} season={season} profile={profile} campuses={visibleCampuses} campusId={campusId} setCampusId={setCampusId} jump={jump} />}
          {tab === 'enter' && <ReportForm season={season} profile={profile} campuses={visibleCampuses} campusId={campusId} setCampusId={setCampusId} initialWeek={weekEnding} />}
          {tab === 'map' && profile.role === 'admin' && <CampusNetwork jump={jump} />}
          {tab === 'accounts' && profile.role === 'admin' && <Accounts profile={profile} campuses={campuses} />}
          {tab === 'grades' && <Grades profile={profile} campuses={visibleCampuses} />}
          {tab === 'contacts' && <Contacts profile={profile} campuses={visibleCampuses} />}
          {tab === 'materials' && <Materials profile={profile} campuses={visibleCampuses} />}
          {tab === 'notifications' && <Notifications />}
          {tab === 'quarters' && profile.role !== 'campus' && <QuarterView campuses={visibleCampuses} />}
          {tab === 'profile' && <ProfileView profile={profile} onChange={load} />}
        </>}
      </div>
      <footer className="page-footer"><span>© Kharis On Campus</span></footer>
    </main>
    {profile?.status === 'active' && <AgentDock placement="dashboard" />}
  </div>;
}
