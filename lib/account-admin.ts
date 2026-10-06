import type { Profile, Role, Status } from './koc';
import { supabase } from './supabase';
export type AccessDraft = { role: Role; status: Status; campusId: string; clusterId: string; reason: string };
export const accessDraft = (user: Profile): AccessDraft => ({role:user.role,status:user.status,campusId:user.campus_id ?? '',clusterId:user.cluster_id ?? '',reason:user.rejection_reason ?? ''});
export function validateAccessDraft(draft: AccessDraft): string | null {
  if (draft.role === 'campus' && !draft.campusId) return 'Choose a university for this campus account.';
  if (draft.role === 'cluster' && !draft.clusterId) return 'Choose a cluster for this cluster lead.';
  if (draft.status === 'rejected' && !draft.reason.trim()) return 'Enter a reason for declining or blocking access.';
  if (draft.reason.trim().length > 1000) return 'Keep the reason within 1,000 characters.';
  return null;
}
export const accessChanges = (draft: AccessDraft) => ({role:draft.role,status:draft.status,campusId:draft.role === 'campus' ? draft.campusId : null,clusterId:draft.role === 'cluster' ? draft.clusterId : null,rejectionReason:draft.status === 'rejected' ? draft.reason.trim() : null});
export async function saveAccountAccess(id: string, draft: AccessDraft) {
  const invalid = validateAccessDraft(draft); if (invalid) throw new Error(invalid);
  const changes = accessChanges(draft);
  const { error } = await supabase().rpc('admin_update_user', {p_user_id:id,p_role:changes.role,p_status:changes.status,p_campus_id:changes.campusId,p_cluster_id:changes.clusterId,p_full_name:null,p_rejection_reason:changes.rejectionReason});
  if (error) throw error;
  if (draft.status === 'rejected') {
    try { await deliverAccountEmails(); return { emailQueued: false }; }
    catch { return { emailQueued: true }; }
  }
  return { emailQueued: false };
}
export async function deliverAccountEmails() {
  const { data, error } = await supabase().functions.invoke('account-email-delivery');
  if (error) throw new Error('Email delivery is unavailable or not configured. Queued messages remain saved for retry.');
  if (data && typeof data.failed === 'number' && data.failed > 0) throw new Error('Some application emails could not be sent. They remain saved for retry.');
  return data as { sent: number; failed: number };
}
export type AccountEmailDelivery = { id: string; user_id: string; status: string; last_error: string | null; created_at: string; sent_at: string | null };
export async function listAccountEmailDeliveries(): Promise<AccountEmailDelivery[]> {
  const { data, error } = await supabase().rpc('list_account_email_deliveries');
  if (error) throw error;
  return data ?? [];
}
