'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { updateOwnProfile, changeOwnEmail, changePassword, adminSetEmail, friendly, ROLE_LABELS, type Profile } from '@/lib/koc';

type Feedback = { ok?: string; err?: string };
const TEMP_DOMAIN = '@koc.example';

export default function ProfileView({ profile, onChange }: { profile: Profile; onChange: () => Promise<void> | void }) {
  const [name, setName] = useState(profile.full_name);
  const [details, setDetails] = useState({ phone: profile.phone ?? '', course: profile.course ?? '', studyYear: profile.study_year?.toString() ?? '', bio: profile.bio ?? '' });
  const [email, setEmail] = useState(profile.email);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [fb, setFb] = useState<Record<'name' | 'email' | 'pw', Feedback>>({ name: {}, email: {}, pw: {} });
  const [busy, setBusy] = useState('');
  const isAdmin = profile.role === 'admin' && profile.status === 'active';
  const tempEmail = profile.email.endsWith(TEMP_DOMAIN);

  async function act(key: 'name' | 'email' | 'pw', fn: () => Promise<string>) {
    setBusy(key); setFb((f) => ({ ...f, [key]: {} }));
    try { const ok = await fn(); setFb((f) => ({ ...f, [key]: { ok } })); }
    catch (e) { setFb((f) => ({ ...f, [key]: { err: friendly(e) } })); }
    finally { setBusy(''); }
  }

  const saveName = () => act('name', async () => { await updateOwnProfile({ fullName: name, phone: details.phone, course: details.course, studyYear: details.studyYear === '' ? null : Number(details.studyYear), bio: details.bio }); await onChange(); return 'Your personal profile has been updated.'; });
  const saveEmail = () => act('email', async () => {
    const next = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) throw new Error('Enter a valid email address.');
    if (next === profile.email) throw new Error('That is already your email address.');
    if (isAdmin) { await adminSetEmail(profile.id, next); await onChange(); return 'Your email has been changed. Use it next time you log in.'; }
    await changeOwnEmail(next);
    return `We sent a confirmation link to ${next}. Your email changes once you click it.`;
  });
  const savePassword = () => act('pw', async () => {
    if (pw.next.length < 12) throw new Error('Use at least 12 characters for your new password.');
    if (pw.next !== pw.confirm) throw new Error('The new passwords do not match.');
    await changePassword(profile.email, pw.current, pw.next);
    setPw({ current: '', next: '', confirm: '' });
    return 'Your password has been changed.';
  });

  const note = (f: Feedback) => <>{f.err && <p className="form-error" role="alert">{f.err}</p>}{f.ok && <p className="success-message" role="status">{f.ok}</p>}</>;

  return <>
    <div className="page-heading"><div><div className="eyebrow">MY PROFILE</div><h1>{profile.full_name}</h1>
      <p>{ROLE_LABELS[profile.role]}{profile.campus?.name ? ` · ${profile.campus.name}` : profile.role === 'cluster' ? ' · Assigned cluster' : profile.role !== 'campus' ? ' · All campuses' : ''}</p></div></div>
    <div className="profile-grid">
      <section className="panel padded">
        <h2>Your personal details</h2><p className="muted small">Your account belongs to you. Campus statistics remain with the university, even if its lead changes. Leadership can review your contact and study details.</p>
        <form className="management-form" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
          <label>Full name<Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} /></label>
          <label>Phone number<Input type="tel" value={details.phone} onChange={event => setDetails({...details,phone:event.target.value})} autoComplete="tel" maxLength={40} /><small>Optional; include your country code.</small></label>
          <label>Course<Input value={details.course} onChange={event => setDetails({...details,course:event.target.value})} maxLength={120} /></label>
          <label>Year of study<select value={details.studyYear} onChange={event => setDetails({...details,studyYear:event.target.value})}><option value="">Not provided</option>{Array.from({length:10},(_,i) => i+1).map(year => <option key={year} value={year}>Year {year}</option>)}</select></label>
          <label>About you<textarea value={details.bio} onChange={event => setDetails({...details,bio:event.target.value})} rows={4} maxLength={1000} /><small>Optional; up to 1,000 characters.</small></label>
          {note(fb.name)}
          <button className="button button-yellow" disabled={!!busy}>{busy === 'name' ? 'Saving…' : 'Save profile'}<ArrowRight size={16} /></button>
        </form>
        <form className="management-form divider-top" onSubmit={(e) => { e.preventDefault(); saveEmail(); }}>
          <label>Email address<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <small>{isAdmin ? 'As an administrator your change applies immediately.' : tempEmail
              ? 'This is a temporary address. Ask Minister Bene or Pastor Awo to set your real email from the Accounts page.'
              : 'You will need to confirm the new address from your inbox.'}</small></label>
          {note(fb.email)}
          <button className="button button-yellow" disabled={busy === 'email' || (tempEmail && !isAdmin)}>{busy === 'email' ? 'Saving…' : 'Change email'}<ArrowRight size={16} /></button>
        </form>
      </section>
      <section className="panel padded">
        <h2>Change password</h2>
        <form className="management-form" onSubmit={(e) => { e.preventDefault(); savePassword(); }}>
          <input type="email" value={profile.email} autoComplete="username" readOnly hidden />
          <label>Current password<Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></label>
          <label>New password<Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /><small>At least 12 characters</small></label>
          <label>Confirm new password<Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></label>
          {note(fb.pw)}
          <button className="button button-yellow" disabled={busy === 'pw' || !pw.current || !pw.next}>{busy === 'pw' ? 'Saving…' : 'Change password'}<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  </>;
}
