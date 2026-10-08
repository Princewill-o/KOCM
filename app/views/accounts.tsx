'use client';
import { useEffect, useState } from 'react';
import { Check, X, Mail } from 'lucide-react';
import { listClusters, type Cluster } from '@/lib/platform';
import { listProfiles, adminSetEmail, friendly, ROLE_LABELS, type Profile, type Campus, type Role, type Status } from '@/lib/koc';
import LeadApplicationRecords from './lead-application-records';
import {isInternalAccountEmail} from '@/lib/username-auth';
import { accessDraft, saveAccountAccess, listAccountEmailDeliveries, deliverAccountEmails, type AccessDraft, type AccountEmailDelivery } from '@/lib/account-admin';

export default function Accounts({ profile, campuses }: { profile: Profile; campuses: Campus[] }) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AccessDraft>>({});
  const [deliveries, setDeliveries] = useState<AccountEmailDelivery[]>([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [sendingError, setSendingError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [editingEmail, setEditingEmail] = useState<{ id: string; value: string } | null>(null);

  async function refresh(resetId?: string) {
    const rows = await listProfiles(); setUsers(rows);
    setDrafts(previous => Object.fromEntries(rows.map(user => [user.id,user.id === resetId ? accessDraft(user) : previous[user.id] ?? accessDraft(user)])));
    try { setDeliveries(await listAccountEmailDeliveries()); setDeliveryError(''); }
    catch (e) { setDeliveryError(friendly(e)); }
  }
  useEffect(() => {
    let current = true;
    listProfiles().then(rows => { if (current) { setUsers(rows); setDrafts(Object.fromEntries(rows.map(user => [user.id,accessDraft(user)]))); } }).catch(e => {if (current) setError(friendly(e));});
    listClusters().then(rows => {if (current) setClusters(rows);}).catch(e => {if (current) setError(friendly(e));});
    listAccountEmailDeliveries().then(rows => {if (current) setDeliveries(rows);}).catch(e => {if (current) setDeliveryError(friendly(e));});
    return () => {current = false;};
  }, []);
  function change(id: string, patch: Partial<AccessDraft>) { setDrafts(previous => ({...previous,[id]:{...previous[id],...patch}})); }
  async function run(id: string, action: () => Promise<unknown>, done: string) {
    setBusy(id); setError(''); setMessage('');
    try { await action(); await refresh(id); setMessage(done); return true; }
    catch (e) { setError(friendly(e)); return false; }
    finally { setBusy(''); }
  }
  function save(user: Profile, draft: AccessDraft) {
    return run(user.id, async () => { const result = await saveAccountAccess(user.id,draft); setSendingError(result.emailQueued ? 'Email sending is unavailable or not configured, or a message failed. Unsent messages remain saved for retry.' : ''); }, draft.status === 'rejected' ? `${user.full_name}'s access was declined. Check email delivery below.` : `${user.full_name}'s access updated.`);
  }
  if (!users) return error ? <div className="management-alert" role="alert">{error}</div> : <p role="status" className="loading-line">Loading accounts…</p>;
  const pending = users.filter(user => user.status === 'pending');
  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Accounts &amp; access</h1><p>Review applications and assign administrator, campus or cluster access.</p></div></div>
    {error && <div className="management-alert" role="alert">{error}</div>}
    {message && <p role="status" className="success-message banner-message">{message}</p>}
    <section className="panel padded"><LeadApplicationRecords campuses={campuses} statuses={Object.fromEntries(users.map(user=>[user.id,user.status]))}/></section>
    <section className="panel padded">
      <h2>Pending applications</h2><p className="muted small">Review the role and university or cluster in All accounts before approval. Declined applications queue an email; delivery status is shown below.</p>
      {!pending.length && <p className="empty-line">No pending requests.</p>}
      {pending.map(user => <div className="approval-row" key={user.id}>
        <div><strong>{user.full_name}</strong><p>{user.username ? `@${user.username}` : isInternalAccountEmail(user.email) ? 'Username not set' : user.email} · {user.campus?.name ?? 'No university'}</p>
          <label htmlFor={`decline-${user.id}`} className="small">Decline reason (included in email)</label>
          <input id={`decline-${user.id}`} value={drafts[user.id].reason} maxLength={1000} disabled={!!busy} onChange={event => change(user.id,{reason:event.target.value})} />
        </div>
        <div><button className="button button-yellow" disabled={!!busy} onClick={() => save(user,{...drafts[user.id],status:'active'})}><Check size={16} />Approve</button>
          <button className="button" disabled={!!busy || !drafts[user.id].reason.trim()} onClick={() => save(user,{...accessDraft(user),status:'rejected',reason:drafts[user.id].reason})}><X size={16} />Decline</button></div>
      </div>)}
    </section>
    <section className="panel padded accounts-panel">
      <h2>Cluster leadership</h2><p className="muted small">Assign an existing verified account below. Cluster leads see only their assigned cluster and submit weekly reports for its campuses.</p>
      <div className="management-table-wrap"><table><thead><tr><th>Cluster</th><th>Lead</th><th>Assigned account</th></tr></thead><tbody>{clusters.map(cluster => <tr key={cluster.id}><td>{cluster.name}</td><td>{cluster.lead_name}</td><td>{users.filter(user => user.role === 'cluster' && user.cluster_id === cluster.id && user.status === 'active').map(user => user.full_name).join(', ') || 'Awaiting account assignment'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="panel padded accounts-panel">
      <h2>All accounts</h2><p className="muted small">Administrators manage all campuses and accounts. Stats editors manage all campus statistics. Campus leads access their own university. Cluster leads view and submit weekly reports for their assigned cluster. Each university has one active campus lead, and each campus lead is assigned to one university. Campus statistics stay with that university when a lead changes. Changes take effect when you select Save access.</p>
      <div className="management-table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>University / cluster</th><th>Status</th><th>Save</th></tr></thead><tbody>{users.map(user => {
        const draft = drafts[user.id];
        const unchanged = JSON.stringify(draft) === JSON.stringify(accessDraft(user));
        return <tr key={user.id}>
          <td><strong>{user.full_name}</strong>{user.id === profile.id && <span className="muted"> (you)</span>}</td>
          <td>{user.username ? `@${user.username}` : 'Not set'}</td>
          <td>{editingEmail?.id === user.id ? <form className="inline-form" onSubmit={async event => {event.preventDefault(); const ok = await run(user.id,() => adminSetEmail(user.id,editingEmail.value),`Email updated for ${user.full_name}.`); if (ok) setEditingEmail(null);}}>
            <input type="email" required value={editingEmail.value} onChange={event => setEditingEmail({id:user.id,value:event.target.value})} aria-label={`New email for ${user.full_name}`} autoFocus />
            <button className="icon-text" disabled={!!busy}>Save</button><button type="button" className="icon-text" onClick={() => setEditingEmail(null)}>Cancel</button>
          </form> : <span className="email-cell">{isInternalAccountEmail(user.email) ? 'Not added' : user.email}<button className="icon-text" disabled={!!busy} onClick={() => setEditingEmail({id:user.id,value:isInternalAccountEmail(user.email) ? '' : user.email})} aria-label={`Change email for ${user.full_name}`}><Mail size={14} />Change</button></span>}</td>
          <td><select className="table-select" aria-label={`Role for ${user.full_name}`} value={draft.role} disabled={!!busy} onChange={event => change(user.id,{role:event.target.value as Role})}>{(Object.keys(ROLE_LABELS) as Role[]).map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></td>
          <td>{draft.role === 'campus' ? <select className="table-select" value={draft.campusId} disabled={!!busy} aria-label={`University for ${user.full_name}`} onChange={event => change(user.id,{campusId:event.target.value})}><option value="">Choose university</option>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select> : draft.role === 'cluster' ? <select className="table-select" value={draft.clusterId} disabled={!!busy} aria-label={`Cluster for ${user.full_name}`} onChange={event => change(user.id,{clusterId:event.target.value})}><option value="">Choose cluster</option>{clusters.map(cluster => <option key={cluster.id} value={cluster.id}>{cluster.name} · {cluster.lead_name}</option>)}</select> : <span className="muted">All campuses</span>}</td>
          <td><select className="table-select" value={draft.status} disabled={!!busy} aria-label={`Status for ${user.full_name}`} onChange={event => change(user.id,{status:event.target.value as Status})}><option value="active">Active</option><option value="rejected">Declined / blocked</option><option value="pending">Pending</option></select>
            {draft.status === 'rejected' && <textarea aria-label={`Decline reason for ${user.full_name}`} placeholder="Reason included in email" maxLength={1000} value={draft.reason} disabled={!!busy} onChange={event => change(user.id,{reason:event.target.value})} />}</td>
          <td><button className="button button-yellow" disabled={!!busy || unchanged} onClick={() => save(user,draft)}>{busy === user.id ? 'Saving…' : 'Save access'}</button>{!unchanged && <button className="icon-text" disabled={!!busy} onClick={() => change(user.id,accessDraft(user))}>Reset</button>}</td>
        </tr>;
      })}</tbody></table></div><p className="chart-explainer">Email changes take effect when you save the email. The system always keeps at least one active administrator.</p>
    </section>
    <section className="panel padded accounts-panel"><h2>Account and reporting emails</h2><p className="muted small">Queued messages have not been sent. Sent means the email provider accepted the message; inbox delivery is not guaranteed.</p>
      <button className="button" disabled={!!busy} onClick={() => refresh().catch(e => setError(friendly(e)))}>Refresh status</button>
      <button className="button" disabled={!!busy} onClick={() => run('emails',async () => { await deliverAccountEmails(); setSendingError(''); },'Email delivery attempted. Review each message status below.')}>Retry queued emails</button>
      {sendingError && <p role="alert" className="management-alert">{sendingError}</p>}
      {deliveryError && <p role="alert" className="management-alert">Email status unavailable: {deliveryError}</p>}
      {!deliveryError && !deliveries.length && <p className="empty-line">No queued emails yet.</p>}
      {!!deliveries.length && <div className="management-table-wrap"><table><thead><tr><th>Account</th><th>State</th><th>Queued</th><th>Sent</th></tr></thead><tbody>{deliveries.map(delivery => <tr key={delivery.id}><td>{users.find(user => user.id === delivery.user_id)?.email ?? 'Account'}</td><td>{delivery.status}{delivery.last_error && <p className="small muted">{delivery.last_error}</p>}</td><td>{new Date(delivery.created_at).toLocaleString('en-GB')}</td><td>{delivery.sent_at ? new Date(delivery.sent_at).toLocaleString('en-GB') : 'Not sent'}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
