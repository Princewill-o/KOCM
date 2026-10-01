'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { updateOwnName, changeOwnEmail, changePassword, adminSetEmail, friendly, ROLE_LABELS, type Profile } from '@/lib/koc';

type Feedback = { ok?: string; err?: string };
const TEMP_DOMAIN = '@koc.example';

export default function ProfileView({ profile, onChange }: { profile: Profile; onChange: () => Promise<void> | void }) {
  const [name, setName] = useState(profile.full_name);
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

  const saveName = () => act('name', async () => { await updateOwnName(profile.id, name); await onChange(); return 'Your name has been updated.'; });
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
      <p>{ROLE_LABELS[profile.role]}{profile.campus?.name ? ` · ${profile.campus.name}` : profile.role !== 'campus' ? ' · All campuses' : ''}</p></div></div>
    <div className="profile-grid">
      <section className="panel padded">
        <h2>Your details</h2>
        <form className="management-form" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
          <label>Full name<Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} /></label>
          {note(fb.name)}
          <button className="button button-yellow" disabled={busy === 'name' || name.trim() === profile.full_name}>{busy === 'name' ? 'Saving…' : 'Save name'}<ArrowRight size={16} /></button>
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
