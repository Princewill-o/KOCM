'use client';
import { collectPages } from './pagination';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase';
import { friendly, type Report } from './koc';

export type CampusLeadProfile = {
  campus_id: string; campus_name: string; region: string;
  latitude: number | null; longitude: number | null; meeting_info: string | null;
  address: string | null; cluster_name: string | null; lead_id: string | null;
  lead_name: string | null; lead_email: string | null; lead_phone: string | null;
  lead_course: string | null; lead_year: number | null; lead_bio: string | null;
};
export async function listCampusLeadProfiles(): Promise<CampusLeadProfile[]> {
  return checked(await supabase().rpc('campus_lead_profiles'));
}

export type Cluster = { id: string; name: string; lead_name: string; is_active: boolean };
export type Grade = { id: string; campus_id: string; student_name: string; course: string; assessment: string; percentage: number; assessment_date: string; notes: string; submitted_by: string; created_at: string };
export type Contact = { id: string; campus_id: string; full_name: string; phone: string; fellowship_attended: boolean; branch_attended: boolean; notes: string; is_active: boolean; created_by: string; created_at: string; updated_at: string };
export type Notification = { id: string; recipient_id: string; kind: string; title: string; message: string; campus_id: string | null; report_id: string | null; grade_id: string | null; created_at: string; read_at: string | null };
export type Material = { page_count: number; protected_ready: boolean; id: string; title: string; description: string; object_path: string; campus_id: string | null; uploaded_by: string; is_active: boolean; created_at: string; updated_at: string };
function checked<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) throw new Error(friendly(result.error));
  return result.data as T;
}
export async function listClusters(): Promise<Cluster[]> {
  return checked(await supabase().from('clusters').select('*').eq('is_active', true).order('name'));
}
export async function listTrendReports(): Promise<Report[]> {
  return collectPages(async (from,to) => checked<Report[]>(await supabase().from('reports').select('*').order('week_ending').order('id').range(from,to)));
}
export async function listGrades(campusId?: string): Promise<Grade[]> {
  return collectPages(async (from,to) => {
    let query = supabase().from('grades').select('*').order('assessment_date', { ascending: false }).order('id').range(from,to);
    if (campusId) query = query.eq('campus_id', campusId);
    return checked<Grade[]>(await query);
  });
}
export async function submitGrade(input: { campusId: string; studentName: string; course: string; assessment: string; percentage: number; assessmentDate: string; notes: string }): Promise<Grade> {
  return checked(await supabase().rpc('submit_grade', { p_campus_id: input.campusId, p_student_name: input.studentName, p_course: input.course, p_assessment: input.assessment, p_percentage: input.percentage, p_assessment_date: input.assessmentDate, p_notes: input.notes }));
}
export async function listContacts(campusId?: string): Promise<Contact[]> {
  return collectPages(async (from,to) => {
    let query = supabase().from('contacts').select('*').eq('is_active', true).order('full_name').order('id').range(from,to);
    if (campusId) query = query.eq('campus_id', campusId);
    return checked<Contact[]>(await query);
  });
}
export async function saveContact(input: { id?: string; campusId: string; fullName: string; phone: string; fellowshipAttended: boolean; branchAttended: boolean; notes: string }): Promise<Contact> {
  const values = { campus_id: input.campusId, full_name: input.fullName.trim(), phone: input.phone.trim(), fellowship_attended: input.fellowshipAttended, branch_attended: input.branchAttended, notes: input.notes.trim() };
  if (input.id) { const changes = { full_name: values.full_name, phone: values.phone, fellowship_attended: values.fellowship_attended, branch_attended: values.branch_attended, notes: values.notes }; return checked(await supabase().from('contacts').update(changes).eq('id', input.id).select().single()); }
  return checked(await supabase().from('contacts').insert(values).select().single());
}
export async function archiveContact(id: string) {
  checked(await supabase().from('contacts').update({ is_active: false }).eq('id', id).select('id').single());
}
export async function listNotifications(): Promise<Notification[]> {
  return collectPages(async (from,to) => checked<Notification[]>(await supabase().from('notifications').select('*').order('created_at', { ascending: false }).order('id').range(from,to)));
}
export async function acknowledgeNotification(id: string) {
  checked(await supabase().rpc('acknowledge_notification', { p_notification_id: id }));
}
export async function listMaterials(): Promise<Material[]> {
  return collectPages(async (from,to) => checked<Material[]>(await supabase().from('materials').select('*').eq('is_active', true).order('created_at', { ascending: false }).order('id').range(from,to)));
}
export async function uploadMaterial(file: File, input: { title: string; description: string; campusId: string | null }, onProgress?: (message: string) => void): Promise<Material> {
  const { publishProtectedMaterial } = await import('./material-publishing');
  return publishProtectedMaterial(file,input,onProgress);
}
export async function archiveMaterial(id: string) {
  checked(await supabase().from('materials').update({ is_active: false }).eq('id', id).select('id').single());
}
export async function readMaterialPage(materialId: string, page: number, sessionId?: string, signal?: AbortSignal): Promise<{blob: Blob; sessionId: string; pageCount: number}> {
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session) throw new Error('Please log in to read materials.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protected-material-page`, {
    method:'POST', headers:{'Content-Type':'application/json', 'apikey':SUPABASE_PUBLISHABLE_KEY, 'Authorization':`Bearer ${data.session.access_token}`},
    body:JSON.stringify({materialId,page,sessionId:sessionId ?? null}), signal, cache:'no-store', credentials:'omit', redirect:'error',
  });
  if (!response.ok) {
    const failure = await response.json().catch(()=>({error:'The protected page could not be opened.'}));
    throw new Error(failure && typeof failure === 'object' && 'error' in failure && typeof failure.error==='string' ? failure.error : 'The protected page could not be opened.');
  }
  const id=response.headers.get('X-Reader-Session'), count=Number(response.headers.get('X-Page-Count'));
  if (!id || !Number.isInteger(count) || count<1 || count>100 || response.headers.get('Content-Type')?.split(';')[0]!=='image/png') throw new Error('The protected page response was invalid.');
  const blob=await response.blob();
  if (blob.size>8*1024*1024 || !blob.size) throw new Error('The protected page response was invalid.');
  return {blob,sessionId:id,pageCount:count};
}
export async function updateCampusDetails(id: string, input: { clusterId: string | null; latitude: number | null; longitude: number | null; address: string; meetingInfo: string; contactEmail: string }) {
  checked(await supabase().from('campuses').update({ cluster_id: input.clusterId, latitude: input.latitude, longitude: input.longitude, address: input.address.trim(), meeting_info: input.meetingInfo.trim(), contact_email: input.contactEmail.trim() }).eq('id', id).select('id').single());
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw new Error(friendly(error));
  return count ?? 0;
}
