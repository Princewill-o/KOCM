'use client';
import { useEffect, useState } from 'react';
import { Check, X, Mail } from 'lucide-react';
import { listClusters, type Cluster } from '@/lib/platform';
import { listProfiles, adminUpdateUser, adminSetEmail, friendly, ROLE_LABELS, type Profile, type Campus, type Role, type Status } from '@/lib/koc';

export default function Accounts({ profile, campuses }: { profile: Profile; campuses: Campus[] }) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [editingEmail, setEditingEmail] = useState<{ id: string; value: string } | null>(null);

  const refresh = () => listProfiles().then(setUsers).catch((e) => setError(friendly(e)));
  useEffect(() => { refresh(); listClusters().then(setClusters).catch(e => setError(friendly(e))); }, []);

  async function run(id: string, action: () => Promise<unknown>, done: string) {
    setBusy(id); setError(''); setMessage('');
    try { await action(); await refresh(); setMessage(done); }
    catch (e) { setError(friendly(e)); }
    finally { setBusy(''); }
  }

  if (!users) return error ? <div className="management-alert" role="alert">{error}</div> : <p role="status" className="loading-line">Loading accounts…</p>;
  const pending = users.filter((u) => u.status === 'pending');
  const others = users;

  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Accounts &amp; access</h1><p>Approve campus representatives and manage who can see or enter statistics.</p></div></div>
    {error && <div className="management-alert" role="alert">{error}</div>}
    {message && <p role="status" className="success-message banner-message">{message}</p>}
    <section className="panel padded">
      <h2>Pending campus requests</h2>
      <p className="muted small">Approved representatives can view and update only their own university.</p>
      {!pending.length && <p className="empty-line">No pending requests.</p>}
      {pending.map((u) => <div className="approval-row" key={u.id}>
        <div><strong>{u.full_name}</strong><p>{u.email} · {u.campus?.name ?? 'No university'}</p></div>
        <div><button className="button button-yellow" disabled={busy === u.id} onClick={() => run(u.id, () => adminUpdateUser(u.id, { status: 'active' }), `${u.full_name} approved.`)}><Check size={16} />Approve</button>
          <button className="button" disabled={busy === u.id} onClick={() => run(u.id, () => adminUpdateUser(u.id, { status: 'rejected' }), `${u.full_name} declined.`)}><X size={16} />Decline</button></div>
      </div>)}
    </section>
    <section className="panel padded accounts-panel">
      <h2>Cluster leadership</h2>
      <p className="muted small">Assign a verified existing account to a cluster below. A cluster lead sees only that cluster’s campuses. Named leads require their own verified email accounts before access can be assigned.</p>
      <div className="management-table-wrap"><table><thead><tr><th>Cluster</th><th>Lead</th><th>Assigned account</th></tr></thead><tbody>{clusters.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.lead_name}</td><td>{users.filter(u => u.role === 'cluster' && u.cluster_id === c.id && u.status === 'active').map(u => u.full_name).join(', ') || 'Awaiting account assignment'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="panel padded accounts-panel">
      <h2>All accounts</h2>
      <p className="muted small"><strong>Administrator</strong>: everything, including accounts. <strong>Stats editor</strong>: sees all campuses and enters weekly stats for any campus. <strong>Campus rep</strong>: own university only. <strong>Cluster lead</strong>: reads assigned cluster campuses, grades and people.</p>
      <div className="management-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>University / cluster</th><th>Status</th></tr></thead>
        <tbody>{others.map((u) => {
          const self = u.id === profile.id;
          return <tr key={u.id}>
            <td><strong>{u.full_name}</strong>{self && <span className="muted"> (you)</span>}</td>
            <td>{editingEmail?.id === u.id
              ? <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(u.id, () => adminSetEmail(u.id, editingEmail.value), `Email updated for ${u.full_name}.`).then(() => setEditingEmail(null)); }}>
                  <input type="email" value={editingEmail.value} onChange={(e) => setEditingEmail({ id: u.id, value: e.target.value })} aria-label={`New email for ${u.full_name}`} autoFocus />
                  <button className="icon-text" disabled={busy === u.id}>Save</button><button type="button" className="icon-text" onClick={() => setEditingEmail(null)}>Cancel</button></form>
              : <span className="email-cell">{u.email}<button className="icon-text" onClick={() => setEditingEmail({ id: u.id, value: u.email })} aria-label={`Change email for ${u.full_name}`}><Mail size={14} />Change</button></span>}</td>
            <td><select className="table-select" value={u.role} disabled={busy === u.id}
              onChange={(e) => {
                const role = e.target.value as Role;
                if (role === 'campus' && !u.campus_id) { setError('Choose a university for this person first, then make them a campus rep.'); return; }
                if (role === 'cluster' && !u.cluster_id) { setError('Choose a cluster for this person first using the cluster assignment below.'); return; }
                run(u.id, () => adminUpdateUser(u.id, { role, campusId: u.campus_id, clusterId: u.cluster_id }), `${u.full_name} is now ${ROLE_LABELS[role].toLowerCase()}.`);
              }}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
            <td><div className="account-scope-controls">
              <select className="table-select" value={u.campus_id ?? ''} disabled={busy === u.id} aria-label={`University for ${u.full_name}`}
                onChange={e => run(u.id, () => adminUpdateUser(u.id, {role:'campus',campusId:e.target.value}), `${u.full_name} assigned to a university.`)}>
                <option value="" disabled>{u.role === 'campus' ? 'Choose university' : 'Assign campus account…'}</option>
                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="table-select" value={u.role === 'cluster' ? u.cluster_id ?? '' : ''} disabled={busy === u.id} aria-label={`Cluster for ${u.full_name}`}
                onChange={e => run(u.id, () => adminUpdateUser(u.id, {role:'cluster',clusterId:e.target.value}), `${u.full_name} assigned as cluster lead.`)}>
                <option value="" disabled>Assign cluster lead…</option>{clusters.map(c => <option key={c.id} value={c.id}>{c.name} · {c.lead_name}</option>)}
              </select>
            </div></td>
            <td><select className="table-select" value={u.status} disabled={busy === u.id}
              onChange={(e) => run(u.id, () => adminUpdateUser(u.id, { status: e.target.value as Status }), `${u.full_name}'s access updated.`)}>
              <option value="active">Active</option><option value="rejected">Blocked</option><option value="pending">Pending</option></select></td>
          </tr>;
        })}</tbody></table></div>
      <p className="chart-explainer">Changing someone’s email here takes effect immediately — use it to replace temporary addresses. At least one active administrator is always kept.</p>
    </section>
  </>;
}
