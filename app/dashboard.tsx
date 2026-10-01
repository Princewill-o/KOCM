'use client';
import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from './theme';
import { supabase } from '@/lib/supabase';
import { currentProfile, currentSeason, listCampuses, signOut, canSeeAllCampuses, ROLE_LABELS, friendly, type Profile, type Campus } from '@/lib/koc';
import type { Season } from '@/lib/reporting';
import Overview from './views/overview';
import CampusView from './views/campus-view';
import ReportForm from './views/report-form';
import Accounts from './views/accounts';
import ProfileView from './views/profile';
import './management.css';

export type Tab = 'overview' | 'campus' | 'enter' | 'accounts' | 'profile';
export type Jump = (tab: Tab, opts?: { campusId?: string; weekEnding?: string }) => void;

function tabsFor(p: Profile): { id: Tab; label: string }[] {
  if (p.status !== 'active') return [{ id: 'profile', label: 'My profile' }];
  if (p.role === 'campus') return [
    { id: 'campus', label: 'My campus' }, { id: 'enter', label: 'Weekly report' }, { id: 'profile', label: 'My profile' },
  ];
  return [
    { id: 'overview', label: 'Overview' }, { id: 'campus', label: 'Campuses' }, { id: 'enter', label: 'Enter stats' },
    ...(p.role === 'admin' ? [{ id: 'accounts' as Tab, label: 'Accounts' }] : []),
    { id: 'profile', label: 'My profile' },
  ];
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

  const load = useCallback(async () => {
    try {
      const p = await currentProfile();
      if (!p) { window.location.replace('/login'); return; }
      setProfile(p);
      const tabs = tabsFor(p);
      const fromHash = window.location.hash.slice(1) as Tab;
      setTab(tabs.some((t) => t.id === fromHash) ? fromHash : tabs[0].id);
      if (p.status === 'active') {
        const [s, c] = await Promise.all([currentSeason(), listCampuses()]);
        setSeason(s); setCampuses(c);
        setCampusId((prev) => prev || (p.role === 'campus' ? p.campus_id ?? '' : c[0]?.id ?? ''));
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

  const jump: Jump = (next, opts) => {
    if (opts?.campusId) setCampusId(opts.campusId);
    setWeekEnding(opts?.weekEnding ?? '');
    setTab(next);
    history.replaceState(null, '', `#${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function logout() {
    // The SIGNED_OUT listener above redirects; this is a fallback if it doesn't fire.
    await signOut();
    setTimeout(() => window.location.replace('/login'), 1500);
  }

  const tabs = profile ? tabsFor(profile) : [];
  const allAccess = canSeeAllCampuses(profile);

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/dashboard"><span className="logo-box"><img src="/kharis-logo.png" alt="Kharis dove" /></span><span>KHARIS<span className="brand-small">ON CAMPUS</span></span></a>
      <nav aria-label="Main navigation">{tabs.map((t) => <button key={t.id} className={tab === t.id ? 'nav-active' : ''} onClick={() => jump(t.id)}>{t.label}</button>)}</nav>
      <div className="header-actions">
        <ThemeToggle />
        {profile && <button className="user-chip" onClick={() => jump('profile')} title="My profile"><span className="user-name">{profile.full_name}</span><span className="role-badge">{ROLE_LABELS[profile.role]}</span></button>}
        <button className="quiet-link" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
      </div>
    </header>
    <main className="workspace">
      <div className="breadcrumb">Kharis On Campus Management<span>/ {tabs.find((t) => t.id === tab)?.label}</span></div>
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
          {tab === 'overview' && allAccess && <Overview season={season} profile={profile} jump={jump} />}
          {tab === 'campus' && <CampusView key={campusId} season={season} profile={profile} campuses={campuses} campusId={campusId} setCampusId={setCampusId} jump={jump} />}
          {tab === 'enter' && <ReportForm season={season} profile={profile} campuses={campuses} campusId={campusId} setCampusId={setCampusId} initialWeek={weekEnding} />}
          {tab === 'accounts' && profile.role === 'admin' && <Accounts profile={profile} campuses={campuses} />}
          {tab === 'profile' && <ProfileView profile={profile} onChange={load} />}
        </>}
      <footer className="page-footer"><span>© Kharis On Campus · United in purpose.</span><span>Your campus, one week at a time.</span></footer>
    </main>
  </div>;
}
